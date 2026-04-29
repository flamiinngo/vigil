#!/usr/bin/env python3
# main.py — Vigil node entry point
#
# Usage:
#   python main.py                          — start node (uses NODE_ID from .env)
#   NODE_ID=vigil-node-2 python main.py     — start second node with different wallet slice
#
# First time setup:
#   python discover.py                      — discover and score wallets from on-chain data
#   python main.py                          — start the node

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

_parser = argparse.ArgumentParser(add_help=False)
_parser.add_argument("--env", default=None)
_args, _ = _parser.parse_known_args()
load_dotenv(_args.env or (Path(__file__).parent.parent / ".env"))

ROOT = Path(__file__).parent.parent
NODE_ID = os.getenv("NODE_ID", "vigil-node-1")


def print_banner():
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                         VIGIL                            ║
║     Decentralized On-Chain Intelligence Network          ║
║                                                          ║
║  Node     : {NODE_ID:<44} ║
║  Network  : Gensyn AXL + Ethereum Mainnet                ║
║  Uniswap  : v3 data enrichment active                    ║
╚══════════════════════════════════════════════════════════╝
""")


def check_wallets() -> bool:
    """Return True if wallets.json exists and has entries."""
    wallets_file = ROOT / "wallets.json"
    if not wallets_file.exists():
        return False
    try:
        wallets = json.loads(wallets_file.read_text())
        return len(wallets) > 0
    except Exception:
        return False


ACTIVITY_FILE = ROOT / "activity.json"


def _write_activity(movement: dict):
    """Append to shared activity.json — reads existing entries first so both nodes contribute."""
    from consensus import _symbols
    token = movement.get("token_address", "")
    tx    = movement.get("tx_hash", "")
    entry = {
        "wallet":        movement.get("involved_wallets", [""])[0],
        "token_address": token,
        "symbol":        _symbols.get(token, ""),
        "direction":     movement.get("direction", ""),
        "score":         (movement.get("wallet_scores") or [0])[0],
        "block_number":  movement.get("block_number", ""),
        "tx_hash":       tx,
        "timestamp":     movement.get("timestamp", 0),
        "node_id":       NODE_ID,
    }
    try:
        try:
            existing = json.loads(ACTIVITY_FILE.read_text())
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []
        # Deduplicate by tx_hash+node so same tx isn't logged twice by same node
        seen = {(e.get("tx_hash"), e.get("node_id")) for e in existing}
        if (tx, NODE_ID) not in seen:
            combined = [entry] + existing
            combined.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
            ACTIVITY_FILE.write_text(json.dumps(combined[:120], indent=2))
    except Exception:
        pass


async def reasoning_pipeline(raw_queue: asyncio.Queue, outgoing_queue: asyncio.Queue):
    """
    All movements from the watcher pass through here.
    Every movement is written to the live activity feed.
    Inbound movements are forwarded to consensus as observations.
    """
    print("[MAIN] Movement pipeline active")
    while True:
        movement = await raw_queue.get()
        token = movement.get("token_address", "")
        direction = movement.get("direction", "")

        if token:
            _write_activity(movement)

        if direction == "inbound" and token:
            observation = {
                **movement,
                "node_id": NODE_ID,
            }
            await outgoing_queue.put(observation)

        raw_queue.task_done()


async def broadcast_pipeline(outgoing_queue: asyncio.Queue):
    """Submit observations to local consensus and broadcast to AXL peers."""
    from messenger import send_observation
    from consensus import process_observation

    print("[MAIN] Broadcast pipeline active")
    while True:
        obs = await outgoing_queue.get()
        await process_observation(obs, NODE_ID)
        await send_observation(obs)
        outgoing_queue.task_done()


async def inbound_pipeline(peer_queue: asyncio.Queue):
    """Process observations received from peer nodes via AXL."""
    from consensus import process_observation

    print("[MAIN] Inbound peer pipeline active")
    while True:
        peer_obs = await peer_queue.get()
        await process_observation(peer_obs, NODE_ID)
        peer_queue.task_done()


async def status_reporter():
    """Print a heartbeat every 60 seconds."""
    from consensus import _pending, _load_signals

    while True:
        await asyncio.sleep(60)
        signals = _load_signals() if hasattr(_load_signals, '__call__') else []
        try:
            from consensus import _load_signals as ls
            signals = ls()
        except Exception:
            signals = []
        print(f"\n[STATUS] {NODE_ID} — "
              f"{len(signals)} signals | "
              f"{len(_pending)} tokens pending consensus\n")


def ensure_signals_file():
    path = ROOT / "signals.json"
    if not path.exists():
        path.write_text("[]")


async def main():
    print_banner()
    ensure_signals_file()

    if not check_wallets():
        print("[MAIN] wallets.json not found or empty.")
        print("[MAIN] Run this first:  python discover.py")
        print("[MAIN] Then restart:    python main.py")
        sys.exit(1)

    raw_queue = asyncio.Queue()
    outgoing_queue = asyncio.Queue()
    peer_queue = asyncio.Queue()

    from watcher import watcher_loop
    from messenger import poll_loop

    print("[MAIN] Starting all pipelines...\n")

    tasks = [
        asyncio.create_task(watcher_loop(raw_queue),           name="watcher"),
        asyncio.create_task(
            reasoning_pipeline(raw_queue, outgoing_queue),     name="reasoning"),
        asyncio.create_task(broadcast_pipeline(outgoing_queue), name="broadcast"),
        asyncio.create_task(poll_loop(peer_queue),              name="axl-poll"),
        asyncio.create_task(inbound_pipeline(peer_queue),       name="inbound"),
        asyncio.create_task(status_reporter(),                  name="status"),
    ]

    print("[MAIN] All systems running. Watching for smart money...\n")

    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        for t in tasks:
            t.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[MAIN] Node stopped.")
        sys.exit(0)
