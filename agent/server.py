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
PORT            = int(os.getenv("PORT") or os.getenv("API_PORT") or 5050)

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
    axl_url = os.getenv("AXL_URL", "http://amusing-gentleness.railway.internal:9002")
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


GENSYN_BOOTSTRAP_IPS = {"34.46.48.224", "136.111.135.206"}

@app.route("/network")
def network():
    """Full network state: our AXL node + all connected peers from topology."""
    axl_url = os.getenv("AXL_URL", "http://amusing-gentleness.railway.internal:9002")
    node_id = os.getenv("NODE_ID", "vigil-node-1")
    nodes = []

    try:
        with urllib.request.urlopen(f"{axl_url}/topology", timeout=3) as r:
            topo = json.loads(r.read())

        peers_raw = topo.get("peers", [])
        our_key = topo.get("our_public_key", "")

        nodes.append({
            "id": node_id,
            "online": True,
            "peers": len(peers_raw),
            "public_key": our_key[:20] if our_key else "",
            "is_self": True,
            "node_type": "vigil",
        })

        # Collect AXL keys of known remote Vigil nodes
        known_vigil_keys = set()
        remote_urls = [u.strip() for u in os.getenv("VIGIL_NETWORK_URL", "").split(",") if u.strip()]
        for url in remote_urls:
            try:
                with urllib.request.urlopen(f"{url.rstrip('/')}/axl-status", timeout=3) as rv:
                    rd = json.loads(rv.read())
                    if rd.get("online") and rd.get("our_public_key"):
                        known_vigil_keys.add(rd["our_public_key"])
            except Exception:
                pass

        for i, p in enumerate(peers_raw):
            if isinstance(p, dict):
                pk = p.get("public_key") or p.get("PublicKey") or ""
                addr = p.get("address") or p.get("addr") or ""
            else:
                pk = str(p)
                addr = ""
            ip = addr.split("@")[-1].split(":")[0] if "@" in addr else ""
            is_bootstrap = ip in GENSYN_BOOTSTRAP_IPS
            is_vigil = pk in known_vigil_keys
            nodes.append({
                "id": pk[:16] if pk else f"peer-{i}",
                "online": True,
                "peers": 0,
                "public_key": pk[:20] if pk else "",
                "address": addr,
                "is_self": False,
                "node_type": "vigil" if is_vigil else "gensyn",
            })
    except Exception:
        nodes.append({
            "id": node_id, "online": False, "peers": 0,
            "public_key": "", "is_self": True, "node_type": "vigil",
        })

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
    import time as _time
    now = _time.time()
    for n in nodes:
        stats = node_stats.get(n["id"], {})
        n["broadcasts"] = stats.get("broadcasts", 0)
        n["unique_tokens"] = len(stats.get("tokens", set()))

    # Add any Vigil nodes seen in activity that aren't already in the topology nodes
    topology_ids = {n["id"] for n in nodes}
    for nid, stats in node_stats.items():
        if not nid or nid in topology_ids:
            continue
        last_ts = max((a.get("timestamp", 0) for a in activities if a.get("node_id") == nid), default=0)
        nodes.append({
            "id": nid,
            "online": (now - last_ts) < 1800,  # online if active in last 30 min
            "peers": 0,
            "public_key": "",
            "is_self": False,
            "node_type": "vigil",
            "broadcasts": stats["broadcasts"],
            "unique_tokens": len(stats["tokens"]),
        })

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

    # All contributing nodes (from activity log — includes remote nodes not in AXL topology)
    all_contributors = [
        {
            "node_id": nid,
            "broadcasts": s["broadcasts"],
            "unique_tokens": len(s["tokens"]),
            "signals": sum(1 for sig in signals if nid in sig.get("node_ids", [])),
        }
        for nid, s in sorted(node_stats.items(), key=lambda x: -x[1]["broadcasts"])
        if nid
    ]

    return jsonify({
        "nodes":       nodes,
        "contributors": all_contributors,
        "messages":    messages[:40],
        "cross_node_events": cross_node,
        "total_broadcasts":  len(activities),
        "consensus_count":   len(signals),
    })


if __name__ == "__main__":
    print(f"[SERVER] Vigil API server running on http://0.0.0.0:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
