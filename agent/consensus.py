# consensus.py — Multi-node consensus engine
#
# Detection is fully rule-based — no LLM involved.
# Signal fires when 2+ distinct smart wallets touch the same token within the window.
# Node count is a confidence multiplier, not the gate — wallet convergence is the signal.

import json
import os
import time
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

CONSENSUS_WINDOW        = int(os.getenv("CONSENSUS_WINDOW", 1200))      # 20 min — catch fast accumulation
CONSENSUS_MIN_WALLETS   = int(os.getenv("CONSENSUS_MIN_WALLETS", 2))     # 2+ distinct smart wallets = signal
CONSENSUS_MIN_LIQUIDITY = float(os.getenv("CONSENSUS_MIN_LIQUIDITY", "5000"))  # $5k floor — new tokens start small

# Tokens excluded from signals — stablecoins and wrapped natives are noise,
# not actionable intelligence
EXCLUDED_TOKENS = {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7",  # USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f",  # DAI
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",  # WETH
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",  # WBTC
    "0x956f47f50a910163d8bf957cf5846d573e7f87ca",  # FEI
    "0x4fabb145d64652a948d72533023f6e7a623c7c53",  # BUSD
    "0x8e870d67f660d95d5be530380d0ec0bd388289e1",  # USDP
}
SIGNALS_FILE = Path(__file__).parent.parent / "signals.json"

HOT_TOKENS_FILE = Path(__file__).parent.parent / "hot_tokens.json"

# token_address → list of {node_id, wallets, timestamp}
_pending: dict[str, list] = {}

# token_address → live accumulation stats (pre-consensus intelligence)
_hot: dict[str, dict] = {}

# token_address → symbol (populated when uniswap data is fetched)
_symbols: dict[str, str] = {}


async def process_observation(observation: dict, local_node_id: str) -> bool:
    """
    Register an observation and check if consensus is reached.
    Returns True if a new signal was fired.
    """
    token = observation.get("token_address", "").lower()
    if not token:
        return False
    if token in EXCLUDED_TOKENS:
        return False

    from_node = observation.get("_from_node", local_node_id)
    wallets = observation.get("involved_wallets", [])
    timestamp = observation.get("timestamp", time.time())
    block_number = observation.get("block_number", "")

    # Track every observation in hot tokens (pre-consensus intelligence feed)
    _track_hot(token, from_node, wallets, observation.get("wallet_scores", []))

    if token not in _pending:
        _pending[token] = []

    # Prune observations outside the time window
    cutoff = time.time() - CONSENSUS_WINDOW
    _pending[token] = [o for o in _pending[token] if o["timestamp"] > cutoff]

    # Record each wallet independently — one entry per wallet per node
    seen_wallets = {(o["node_id"], w) for o in _pending[token] for w in o["wallets"]}
    for w in wallets:
        if (from_node, w) not in seen_wallets:
            _pending[token].append({
                "node_id":       from_node,
                "wallets":       [w],
                "wallet_scores": observation.get("wallet_scores", []),
                "block_number":  block_number,
                "timestamp":     timestamp,
            })

    unique_nodes   = {o["node_id"] for o in _pending[token]}
    all_wallets    = list({w for o in _pending[token] for w in o["wallets"]})
    unique_wallets = len(all_wallets)

    print(f"[CONSENSUS] {token[:12]}... — "
          f"{unique_wallets} wallet(s) across {len(unique_nodes)} node(s)")

    if unique_wallets >= CONSENSUS_MIN_WALLETS:
        # Require at least 2 different blocks — same block = same tx seen twice via two subscriptions
        blocks_seen = {o["block_number"] for o in _pending[token] if o.get("block_number")}
        if len(blocks_seen) < 2 and len(blocks_seen) > 0:
            print(f"[CONSENSUS] {token[:12]}... — same block, not independent")
            return False

        wallet_scores = [s for o in _pending[token] for s in o.get("wallet_scores", [])]
        avg_score = round(sum(wallet_scores) / len(wallet_scores), 1) if wallet_scores else 0

        # Confidence: base from wallet scores, boosted when multiple nodes confirm
        node_bonus = 20 if len(unique_nodes) >= 2 else 0
        confidence = round(min(avg_score + node_bonus, 200), 1)

        if token in _hot:
            _hot[token]["consensus_reached"] = True

        tier = "MULTI-NODE VERIFIED" if len(unique_nodes) >= 2 else "SMART MONEY SIGNAL"
        print(f"\n[CONSENSUS] *** {tier} — {token[:12]}... ***")
        print(f"[CONSENSUS] Wallets: {all_wallets}  Nodes: {unique_nodes}  Confidence: {confidence}")
        await fire_signal(token, all_wallets, list(unique_nodes), confidence)
        _pending[token] = []
        return True

    return False


async def fire_signal(token_address: str, wallets: list, node_ids: list, confidence: float = 0):
    """Build enriched signal, generate narrative, write to signals.json."""
    from uniswap import get_token_data, execute_swap
    from reasoner import generate_narrative
    from delphi import create_delphi_market

    signal_id = f"sig_{int(time.time())}"

    # Enrich with live Uniswap data
    print(f"[CONSENSUS] Fetching Uniswap data for {token_address[:12]}...")
    uniswap_data = await get_token_data(token_address)

    # Liquidity floor — skip signals on low-cap / rugpull-tier tokens
    liquidity = uniswap_data.get("liquidity_usd", 0)
    if liquidity < CONSENSUS_MIN_LIQUIDITY:
        print(f"[CONSENSUS] Signal dropped — liquidity ${liquidity:,.0f} "
              f"below ${CONSENSUS_MIN_LIQUIDITY:,.0f} floor")
        return

    signal = {
        "id": signal_id,
        "token_address": token_address,
        "wallets": wallets,
        "wallet_count": len(wallets),
        "node_count": len(node_ids),
        "node_ids": node_ids,
        "timestamp": time.time(),
        "datetime": datetime.now(timezone.utc).isoformat(),
        "status": "verified",
        "confidence": confidence,
        "uniswap": uniswap_data,
        "narrative": "",
        "delphi_market_url": None,
        "auto_swap": None,
    }

    # Generate human-readable narrative
    signal["narrative"] = await generate_narrative(signal)

    # Delphi (stub for now)
    signal["delphi_market_url"] = await create_delphi_market(signal)

    # Optional auto-swap if enabled
    if os.getenv("SWAP_ENABLED", "false").lower() == "true":
        swap_result = await execute_swap(token_address)
        signal["auto_swap"] = swap_result

    # Write to signals.json
    signals = _load_signals()
    signals.insert(0, signal)
    _save_signals(signals)

    symbol = uniswap_data.get("symbol", "")
    if symbol:
        _symbols[token_address] = symbol
    label = f"${symbol}" if symbol else token_address[:12] + "..."
    print(f"[CONSENSUS] Signal written — {label}")
    print(f"[CONSENSUS] Narrative: {signal['narrative']}")
    print(f"[CONSENSUS] Swap: {uniswap_data.get('swap_url', '')}\n")


def _track_hot(token: str, node_id: str, wallets: list, scores: list):
    """Update live accumulation stats for the hot tokens feed."""
    now = time.time()
    cutoff = now - CONSENSUS_WINDOW
    if token not in _hot:
        _hot[token] = {
            "token_address": token,
            "wallets": set(),
            "nodes": set(),
            "scores": [],
            "observation_count": 0,
            "first_seen": now,
            "last_seen": now,
            "consensus_reached": False,
        }
    entry = _hot[token]
    entry["wallets"].update(wallets)
    entry["nodes"].add(node_id)
    entry["scores"].extend(scores)
    entry["observation_count"] += 1
    entry["last_seen"] = now

    # Prune stale tokens and write snapshot
    stale = [t for t, d in _hot.items() if d["last_seen"] < cutoff]
    for t in stale:
        del _hot[t]
    _save_hot_tokens()


def _save_hot_tokens():
    snapshot = []
    for token, d in _hot.items():
        scores = d["scores"]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        snapshot.append({
            "token_address":     token,
            "symbol":            _symbols.get(token, ""),
            "wallet_count":      len(d["wallets"]),
            "node_count":        len(d["nodes"]),
            "observation_count": d["observation_count"],
            "avg_wallet_score":  avg_score,
            "first_seen":        d["first_seen"],
            "last_seen":         d["last_seen"],
            "consensus_reached": d["consensus_reached"],
        })
    snapshot.sort(key=lambda x: (x["wallet_count"], x["node_count"]), reverse=True)
    try:
        with open(HOT_TOKENS_FILE, "w") as f:
            json.dump(snapshot[:50], f, indent=2)
    except Exception:
        pass


def _load_signals() -> list:
    if SIGNALS_FILE.exists():
        try:
            with open(SIGNALS_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def _save_signals(signals: list):
    with open(SIGNALS_FILE, "w") as f:
        json.dump(signals, f, indent=2)
