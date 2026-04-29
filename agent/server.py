# server.py — API server for the Vigil frontend
# Serves signals.json, hot_tokens.json, and AXL status over HTTP.

import json
import os
import urllib.request
from pathlib import Path
from flask import Flask, jsonify
from dotenv import load_dotenv

load_dotenv()

ROOT            = Path(__file__).parent.parent
SIGNALS_FILE    = ROOT / "signals.json"
HOT_TOKENS_FILE = ROOT / "hot_tokens.json"
ACTIVITY_FILE   = ROOT / "activity.json"
WALLETS_FILE    = ROOT / "wallets.json"
PORT            = int(os.getenv("API_PORT", 5050))

app = Flask(__name__)


def read_json_file(filepath):
    try:
        with open(filepath) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/signals.json")
@app.route("/signals")
def signals():
    return jsonify(read_json_file(SIGNALS_FILE))


@app.route("/hot")
@app.route("/hot_tokens.json")
def hot():
    return jsonify(read_json_file(HOT_TOKENS_FILE))


@app.route("/wallets.json")
def wallets():
    return jsonify(read_json_file(WALLETS_FILE))


@app.route("/activity")
def activity():
    return jsonify(read_json_file(ACTIVITY_FILE))


@app.route("/axl-status")
def axl_status():
    axl_url = os.getenv("AXL_URL", "http://localhost:9002")
    try:
        with urllib.request.urlopen(f"{axl_url}/topology", timeout=3) as r:
            topo = json.loads(r.read())
        return jsonify({
            "online": True,
            "peers": len(topo.get("peers", [])),
            "our_public_key": topo.get("our_public_key", ""),
        })
    except Exception:
        return jsonify({"online": False, "peers": 0})


@app.route("/network")
def network():
    """Full network state: both AXL nodes + derived message flow from activity + signals."""
    NODE_AXL_PORTS = [
        ("vigil-node-1", 9002),
        ("vigil-node-2", 9004),
    ]
    nodes = []
    for node_id, port in NODE_AXL_PORTS:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/topology", timeout=2) as r:
                topo = json.loads(r.read())
            nodes.append({
                "id": node_id,
                "online": True,
                "peers": len(topo.get("peers", [])),
                "public_key": topo.get("our_public_key", "")[:20],
            })
        except Exception:
            nodes.append({"id": node_id, "online": False, "peers": 0, "public_key": ""})

    activities = read_json_file(ACTIVITY_FILE)
    signals    = read_json_file(SIGNALS_FILE)

    # Derive per-node stats
    node_stats = {}
    for a in activities:
        nid = a.get("node_id", "")
        if nid not in node_stats:
            node_stats[nid] = {"broadcasts": 0, "tokens": set()}
        node_stats[nid]["broadcasts"] += 1
        node_stats[nid]["tokens"].add(a.get("token_address", ""))
    for n in nodes:
        stats = node_stats.get(n["id"], {})
        n["broadcasts"] = stats.get("broadcasts", 0)
        n["unique_tokens"] = len(stats.get("tokens", set()))

    # Build message flow: observations + consensus events merged and sorted
    messages = []
    for a in activities[:40]:
        messages.append({
            "type":      "observation",
            "node_id":   a.get("node_id", ""),
            "token":     a.get("symbol") or (a.get("token_address") or "")[:8],
            "direction": a.get("direction", ""),
            "timestamp": a.get("timestamp", 0),
            "score":     a.get("score", 0),
        })
    for s in signals[:15]:
        messages.append({
            "type":      "consensus",
            "node_id":   "network",
            "node_ids":  s.get("node_ids", []),
            "token":     (s.get("uniswap") or {}).get("symbol") or (s.get("token_address") or "")[:8],
            "confidence": s.get("confidence", 0),
            "timestamp": s.get("timestamp", 0),
        })
    messages.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # Cross-node events: tokens seen by 2+ distinct nodes
    token_nodes = {}
    for a in activities:
        t = a.get("token_address", "")
        n = a.get("node_id", "")
        if t and n:
            token_nodes.setdefault(t, set()).add(n)
    cross_node = sum(1 for nodes_set in token_nodes.values() if len(nodes_set) >= 2)

    return jsonify({
        "nodes":       nodes,
        "messages":    messages[:40],
        "cross_node_events": cross_node,
        "total_broadcasts":  len(activities),
        "consensus_count":   len(signals),
    })


if __name__ == "__main__":
    print(f"[SERVER] Vigil API server running on http://0.0.0.0:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
