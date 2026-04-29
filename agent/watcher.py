# watcher.py — Ethereum wallet watcher
# Loads wallets from wallets.json and watches this node's assigned slice.
# Each node watches a different subset — split is deterministic by NODE_ID.
#
# Primary: eth_subscribe WebSocket stream with 90s watchdog (silent-drop detection)
# Fallback: eth_getLogs HTTP poll every 60s catches anything the WS subscription misses

import asyncio
import json
import os
import time
import urllib.request
from datetime import datetime
from pathlib import Path
import websockets
from dotenv import load_dotenv

load_dotenv()

NODE_ID = os.getenv("NODE_ID", "vigil-node-1")
WALLETS_FILE = Path(__file__).parent.parent / "wallets.json"

# Public WebSocket RPCs — rotates on failure
WS_URLS = [
    os.getenv("ETH_WS_URL", "wss://ethereum.publicnode.com"),
    "wss://eth.llamarpc.com",
    "wss://mainnet.gateway.tenderly.co",
]

# HTTP RPC for the polling fallback — checks both .env variable names
HTTP_RPC = (os.getenv("ETH_RPC")
            or os.getenv("ETH_RPC_URL")
            or "https://1rpc.io/eth")

# If no WS message is received for this many seconds, force a reconnect.
# Public subs can go silent without a disconnect event.
WS_SILENCE_TIMEOUT = 90

# ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def load_wallet_slice() -> list[dict]:
    """
    Load wallets.json and return this node's assigned slice.

    Wallets are shuffled deterministically by NODE_ID before slicing.
    This ensures each node watches a MIXED pool across all score tiers
    rather than a clean top/bottom split — genuine independence.

    A node watching rank 1,3,5,7... behaves differently from a node
    watching rank 2,4,6,8... even though both have high and low scorers.
    When both independently detect the same token, that's real signal.
    """
    import hashlib

    if not WALLETS_FILE.exists():
        print(f"[WATCHER] wallets.json not found — run: python discover.py")
        return []

    with open(WALLETS_FILE) as f:
        all_wallets = json.load(f)

    if not all_wallets:
        print("[WATCHER] wallets.json is empty — run: python discover.py")
        return []

    # Deterministic shuffle seeded by a stable hash of NODE_ID
    # Each node gets the same shuffle every restart, but different from other nodes
    seed = int(hashlib.md5(NODE_ID.encode()).hexdigest(), 16) % (2**32)
    import random
    rng = random.Random(seed)
    shuffled = all_wallets[:]
    rng.shuffle(shuffled)

    total = int(os.getenv("WALLET_SLICE_TOTAL", "2"))
    try:
        index = int(os.getenv("WALLET_SLICE_INDEX", NODE_ID.split("-")[-1])) - 1
    except ValueError:
        index = 0
    index = max(0, min(index, total - 1))

    chunk = len(shuffled) // total
    start = index * chunk
    end = start + chunk if index < total - 1 else len(shuffled)
    my_slice = shuffled[start:end]

    scores = [w.get("score", 0) for w in my_slice]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    score_range = f"{min(scores)}–{max(scores)}" if scores else "n/a"
    print(f"[WATCHER] Node {NODE_ID} — {len(my_slice)} wallets "
          f"(slice {index + 1}/{total}, avg score={avg_score}, "
          f"range {score_range})")
    return my_slice


def to_topic(address: str) -> str:
    """Pad a 20-byte address to a 32-byte log topic."""
    return "0x" + address.lower().replace("0x", "").zfill(64)


def decode_address(padded: str) -> str | None:
    """Decode a 32-byte padded topic back to a 20-byte address."""
    if not padded or len(padded) < 42:
        return None
    return "0x" + padded[-40:].lower()


_HTTP_FALLBACKS = ["https://1rpc.io/eth", "https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com"]

def _http_rpc(payload: dict) -> dict:
    """Synchronous HTTP JSON-RPC call — tries HTTP_RPC then fallbacks."""
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    for rpc in [HTTP_RPC] + _HTTP_FALLBACKS:
        try:
            req = urllib.request.Request(rpc, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as r:
                result = json.loads(r.read())
            if "result" in result:
                return result
        except Exception:
            continue
    raise RuntimeError("All HTTP RPCs failed")


async def poll_missed_events(
    observations_queue: asyncio.Queue,
    wallet_set: set,
    wallet_meta: dict,
    last_block_ref: list,
):
    """
    HTTP fallback: every 60 s fetch eth_getLogs for recent blocks.
    Catches Transfer events that the WebSocket subscription missed.
    Works on any HTTP endpoint, no subscription required.
    """
    NOISE_TOKENS = {
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        "0x6b175474e89094c44da98b954eedeac495271d0f",
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "0x4fabb145d64652a948d72533023f6e7a623c7c53",
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca",
    }
    seen_txs: set = set()

    while True:
        await asyncio.sleep(60)
        try:
            loop = asyncio.get_event_loop()

            # Current block
            resp = await loop.run_in_executor(None, _http_rpc, {
                "jsonrpc": "2.0", "id": 1,
                "method": "eth_blockNumber", "params": []
            })
            current = int(resp["result"], 16)
            from_block = max(last_block_ref[0], current - 10)  # ~2 min of blocks
            last_block_ref[0] = current

            wallet_topics = [to_topic(addr) for addr in wallet_set]

            # Fetch inbound + outbound transfers in one pass each
            for topic_pos, direction_hint in [(2, "inbound"), (1, "outbound")]:
                topics_filter = [TRANSFER_TOPIC, None, wallet_topics] if topic_pos == 2 else [TRANSFER_TOPIC, wallet_topics, None]
                resp = await loop.run_in_executor(None, _http_rpc, {
                    "jsonrpc": "2.0", "id": 2,
                    "method": "eth_getLogs",
                    "params": [{
                        "fromBlock": hex(from_block),
                        "toBlock": "latest",
                        "topics": topics_filter,
                    }]
                })
                logs = resp.get("result", [])
                for log in logs:
                    tx = log.get("transactionHash", "")
                    key = (tx, direction_hint)
                    if key in seen_txs:
                        continue
                    seen_txs.add(key)
                    # Wrap in the same shape process_log expects
                    synthetic = {"params": {"result": log}}
                    token = (log.get("address") or "").lower()
                    if token not in NOISE_TOKENS:
                        await process_log(synthetic, observations_queue, wallet_set, wallet_meta)

            # Keep seen_txs from growing forever
            if len(seen_txs) > 2000:
                seen_txs.clear()

            print(f"[WATCHER] Poll check — scanned blocks {from_block}→{current}")
        except Exception as e:
            print(f"[WATCHER] Poll error: {e}")


async def watch_wallets(observations_queue: asyncio.Queue):
    """
    Connect to Ethereum WebSocket and stream Transfer events.
    Includes a {WS_SILENCE_TIMEOUT}s watchdog — if the subscription goes silent
    (common on public RPCs) the connection is dropped and recreated.
    A parallel HTTP polling task fills any gaps.
    """
    my_wallets = load_wallet_slice()
    if not my_wallets:
        print("[WATCHER] No wallets to watch — halting watcher")
        return

    wallet_addresses = [w["address"].lower() for w in my_wallets]
    wallet_topics = [to_topic(addr) for addr in wallet_addresses]
    wallet_set = set(wallet_addresses)
    wallet_meta = {w["address"].lower(): w for w in my_wallets}

    print(f"[WATCHER] Watching {len(wallet_addresses)} wallets")
    print(f"[WATCHER] Sample: {wallet_addresses[0][:12]}... "
          f"score={my_wallets[0].get('score', '?')}")

    # Shared block cursor for the polling fallback
    last_block_ref = [0]

    # Start HTTP polling fallback — runs independently of the WS loop
    asyncio.create_task(
        poll_missed_events(observations_queue, wallet_set, wallet_meta, last_block_ref),
        name="poll-fallback",
    )

    ws_index = 0
    while True:
        ws_url = WS_URLS[ws_index % len(WS_URLS)]
        print(f"[WATCHER] Connecting to {ws_url}...")
        try:
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=30) as ws:
                print(f"[WATCHER] Connected. Subscribing to Transfer events...")

                await ws.send(json.dumps({
                    "jsonrpc": "2.0", "id": 1,
                    "method": "eth_subscribe",
                    "params": ["logs", {"topics": [TRANSFER_TOPIC, None, wallet_topics]}]
                }))
                r1 = json.loads(await ws.recv())

                await ws.send(json.dumps({
                    "jsonrpc": "2.0", "id": 2,
                    "method": "eth_subscribe",
                    "params": ["logs", {"topics": [TRANSFER_TOPIC, wallet_topics, None]}]
                }))
                r2 = json.loads(await ws.recv())

                print(f"[WATCHER] Live — sub_in={r1.get('result', 'err')} "
                      f"sub_out={r2.get('result', 'err')}")

                while True:
                    try:
                        # Watchdog: if no message in WS_SILENCE_TIMEOUT seconds,
                        # the subscription has gone silent — force reconnect.
                        raw = await asyncio.wait_for(ws.recv(), timeout=WS_SILENCE_TIMEOUT)
                        try:
                            msg = json.loads(raw)
                            await process_log(msg, observations_queue, wallet_set, wallet_meta)
                        except json.JSONDecodeError:
                            pass
                    except asyncio.TimeoutError:
                        print(f"[WATCHER] No events for {WS_SILENCE_TIMEOUT}s — reconnecting...")
                        break

        except websockets.exceptions.ConnectionClosedError as e:
            print(f"[WATCHER] Connection closed: {e}")
        except OSError as e:
            print(f"[WATCHER] Connection failed: {e}")
        except Exception as e:
            print(f"[WATCHER] Error: {e}")

        ws_index += 1
        print(f"[WATCHER] Reconnecting in 5s...")
        await asyncio.sleep(5)


async def process_log(
    msg: dict,
    observations_queue: asyncio.Queue,
    wallet_set: set,
    wallet_meta: dict,
):
    """Parse a Transfer event log and enqueue matching movements."""
    params = msg.get("params", {})
    result = params.get("result", {})
    if not result or not isinstance(result, dict):
        return

    topics = result.get("topics", [])
    if not topics or topics[0].lower() != TRANSFER_TOPIC.lower():
        return

    from_addr = decode_address(topics[1]) if len(topics) > 1 else None
    to_addr = decode_address(topics[2]) if len(topics) > 2 else None
    token_address = (result.get("address") or "").lower()
    tx_hash = result.get("transactionHash", "")
    block_number = result.get("blockNumber", "0x0")

    # Drop stablecoins and wrapped natives — not actionable intelligence
    NOISE_TOKENS = {
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7",  # USDT
        "0x6b175474e89094c44da98b954eedeac495271d0f",  # DAI
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",  # WETH
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",  # WBTC
        "0x4fabb145d64652a948d72533023f6e7a623c7c53",  # BUSD
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca",  # FEI
    }
    if token_address in NOISE_TOKENS:
        return

    involved = []
    if from_addr and from_addr in wallet_set:
        involved.append(from_addr)
    if to_addr and to_addr in wallet_set:
        involved.append(to_addr)

    if not involved:
        return

    direction = (
        "inbound" if to_addr in wallet_set and from_addr not in wallet_set else
        "outbound" if from_addr in wallet_set and to_addr not in wallet_set else
        "internal"
    )

    # Decode raw token value
    raw_data = result.get("data", "0x")
    try:
        value_raw = int(raw_data, 16)
    except ValueError:
        value_raw = 0

    # Attach wallet metadata (score, diversity) for richer signals
    meta = wallet_meta.get(involved[0], {})

    movement = {
        "tx_hash": tx_hash,
        "from": from_addr,
        "to": to_addr,
        "token_address": token_address,
        "value_raw": value_raw,
        "direction": direction,
        "involved_wallets": list(set(involved)),
        "wallet_scores": [meta.get("score", 0) for _ in involved],
        "block_number": block_number,
        "timestamp": time.time(),
        "datetime": datetime.utcnow().isoformat(),
    }

    print(f"[WATCHER] {direction.upper()} — "
          f"wallet {involved[0][:10]}... "
          f"token {token_address[:10]}... "
          f"score={meta.get('score', '?')} "
          f"(block {int(block_number, 16)})")

    await observations_queue.put(movement)


async def watcher_loop(observations_queue: asyncio.Queue):
    await watch_wallets(observations_queue)
