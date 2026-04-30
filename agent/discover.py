# discover.py — On-chain wallet scorer
# Queries Uniswap v3 Swap events, then resolves tx.from to get real user EOAs.
# Swap event topics encode the router contract, not the user — tx.from is always the EOA.
#
# Method:
#   1. Query eth_getLogs for Uniswap v3 Swap events on top pools
#   2. Collect unique transaction hashes -> fetch tx.from (actual user EOA)
#   3. Score wallets by pool diversity + swap frequency
#   4. Write top wallets to wallets.json
#
# Run: python discover.py --top 100

import asyncio
import json
import os
import time
import argparse
from pathlib import Path
from collections import defaultdict
import httpx
from dotenv import load_dotenv

load_dotenv()

WALLETS_FILE = Path(__file__).parent.parent / "wallets.json"

RPC_URLS = [
    "https://ethereum.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
]

# Uniswap v3 Swap(address indexed sender, address indexed recipient, ...)
SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"

TOP_POOLS = [
    {"address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", "pair": "USDC/WETH 0.05%"},
    {"address": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", "pair": "USDC/WETH 0.3%"},
    {"address": "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", "pair": "USDT/WETH 0.05%"},
    {"address": "0x11b815efB8f581194ae79006d24E0d814B7697F6", "pair": "USDT/WETH 0.3%"},
    {"address": "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168", "pair": "DAI/USDC 0.01%"},
    {"address": "0x60594a405d53811d3BC4766596EFD80fd545A270", "pair": "DAI/WETH 0.05%"},
    {"address": "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD", "pair": "WBTC/WETH 0.3%"},
    {"address": "0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0", "pair": "WBTC/WETH 0.05%"},
    {"address": "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35", "pair": "WBTC/USDC 0.3%"},
    {"address": "0x109830a1AAaD605BbF02a9dFA7a0DF6e3b48f6E9", "pair": "stETH/WETH 0.01%"},
    {"address": "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8", "pair": "LINK/WETH 0.3%"},
    {"address": "0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801", "pair": "UNI/WETH 0.3%"},
    {"address": "0xe8c6c9227491C0a8156A0106A0204d881BB7E531", "pair": "MKR/WETH 0.3%"},
    {"address": "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB", "pair": "AAVE/WETH 0.3%"},
    {"address": "0x919Fa96e88d67499339577Fa202345436dcE2A2F", "pair": "CRV/WETH 0.3%"},
    {"address": "0x290A6a7460B308ee3F19023D2D00dE604bcf5B42", "pair": "MATIC/WETH 0.3%"},
    {"address": "0x11950d141EcB863F01007AdD7D1A342041227b58", "pair": "PEPE/WETH 0.3%"},
    {"address": "0x2F62f2B4c5fcd7570a709DeC05D68EA19c82898B", "pair": "SHIB/WETH 0.3%"},
]

MIN_SWAP_COUNT = 2   # seen in at least 2 transactions
MIN_POOL_COUNT = 1   # trades at least 1 pool (relaxed — tx.from is already a real EOA)
TX_SAMPLE      = 800 # max tx hashes to resolve (keeps runtime under 3 min)


async def rpc_call(client: httpx.AsyncClient, method: str, params: list, rpc_url: str) -> dict:
    resp = await client.post(
        rpc_url,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        headers={"Content-Type": "application/json"},
    )
    resp.raise_for_status()
    result = resp.json()
    if "error" in result:
        raise Exception(f"RPC error: {result['error']}")
    return result.get("result")


async def get_current_block(client: httpx.AsyncClient, rpc_url: str) -> int:
    result = await rpc_call(client, "eth_blockNumber", [], rpc_url)
    return int(result, 16)


async def fetch_swap_events(client, pool_address, from_block, to_block, rpc_url) -> list:
    logs = await rpc_call(client, "eth_getLogs", [{
        "address": pool_address,
        "topics": [SWAP_TOPIC],
        "fromBlock": hex(from_block),
        "toBlock": hex(to_block),
    }], rpc_url)
    return logs or []


async def discover_wallets(blocks_back: int = 3000, top_n: int = 40) -> list[dict]:
    """
    Find active on-chain traders from Uniswap v3.
    Uses tx.from (real user EOA) instead of Swap event topics (which encode routers).
    blocks_back=3000 ≈ last 11 hours on Ethereum.
    """
    rpc_url = RPC_URLS[0]

    print(f"[DISCOVER] Connecting to {rpc_url}...")
    print(f"[DISCOVER] Scanning last {blocks_back} blocks across {len(TOP_POOLS)} pools...")

    # tx_hash -> {pools: set, block: int}
    tx_map: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            current_block = await get_current_block(client, rpc_url)
        except Exception as e:
            print(f"[DISCOVER] Primary RPC failed ({e}), trying fallback...")
            rpc_url = RPC_URLS[1]
            current_block = await get_current_block(client, rpc_url)

        from_block = current_block - blocks_back
        print(f"[DISCOVER] Block range: {from_block} -> {current_block}")

        for pool in TOP_POOLS:
            pool_addr = pool["address"]
            pair_name = pool["pair"]
            pool_count = 0
            chunk = 2000
            block = from_block

            while block < current_block:
                end = min(block + chunk, current_block)
                try:
                    logs = await fetch_swap_events(client, pool_addr, block, end, rpc_url)
                    for log in logs:
                        tx_hash = log.get("transactionHash")
                        if not tx_hash:
                            continue
                        block_num = int(log.get("blockNumber", "0x0"), 16)
                        if tx_hash not in tx_map:
                            tx_map[tx_hash] = {"pools": set(), "block": block_num}
                        tx_map[tx_hash]["pools"].add(pool_addr)
                        tx_map[tx_hash]["block"] = max(tx_map[tx_hash]["block"], block_num)
                    pool_count += len(logs)
                    await asyncio.sleep(0.2)
                except Exception as e:
                    print(f"[DISCOVER] {pair_name} {block}-{end}: {e}")
                    await asyncio.sleep(2)
                    rpc_url = RPC_URLS[(RPC_URLS.index(rpc_url) + 1) % len(RPC_URLS)]
                block = end + 1

            print(f"[DISCOVER] {pair_name}: {pool_count} swaps")

    print(f"\n[DISCOVER] {len(tx_map)} unique transactions — resolving top {TX_SAMPLE} senders...")

    # Sort by most recent block, take top TX_SAMPLE
    sorted_txs = sorted(tx_map.items(), key=lambda x: x[1]["block"], reverse=True)
    sample = sorted_txs[:TX_SAMPLE]

    wallet_stats: dict = defaultdict(lambda: {"pools": set(), "swap_count": 0, "last_seen": 0})

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, (tx_hash, info) in enumerate(sample):
            try:
                tx = await rpc_call(client, "eth_getTransactionByHash", [tx_hash], rpc_url)
                if not tx:
                    continue
                addr = tx.get("from", "").lower()
                if not addr:
                    continue
                wallet_stats[addr]["pools"].update(info["pools"])
                wallet_stats[addr]["swap_count"] += 1
                wallet_stats[addr]["last_seen"] = max(wallet_stats[addr]["last_seen"], info["block"])
                await asyncio.sleep(0.12)
            except Exception:
                pass
            if (i + 1) % 100 == 0:
                print(f"[DISCOVER]   {i + 1}/{len(sample)} transactions resolved...")

    print(f"[DISCOVER] {len(wallet_stats)} unique wallets found")
    print(f"[DISCOVER] Scoring (min_swaps={MIN_SWAP_COUNT}, min_pools={MIN_POOL_COUNT})...")

    scored = []
    for address, stats in wallet_stats.items():
        pool_count = len(stats["pools"])
        swap_count = stats["swap_count"]

        if pool_count < MIN_POOL_COUNT:
            continue
        if swap_count < MIN_SWAP_COUNT:
            continue

        score = round((pool_count * 20) + min(swap_count * 2, 40), 2)
        scored.append({
            "address": address,
            "score": score,
            "pool_diversity": pool_count,
            "swap_count": swap_count,
            "last_seen_block": stats["last_seen"],
            "discovered_at": int(time.time()),
        })

    scored.sort(key=lambda w: w["score"], reverse=True)
    top = scored[:top_n]

    if not top:
        print("[DISCOVER] No wallets found — check RPC connectivity or lower thresholds")
        return []

    print(f"\n[DISCOVER] Top {len(top)} wallets (real EOAs via tx.from):")
    for i, w in enumerate(top[:10], 1):
        print(f"  {i:2}. {w['address'][:14]}... "
              f"score={w['score']} pools={w['pool_diversity']} swaps={w['swap_count']}")

    return top


def save_wallets(wallets: list):
    with open(WALLETS_FILE, "w") as f:
        json.dump(wallets, f, indent=2)
    print(f"\n[DISCOVER] Saved {len(wallets)} wallets to wallets.json")


def load_wallets() -> list:
    if not WALLETS_FILE.exists():
        return []
    try:
        with open(WALLETS_FILE) as f:
            return json.load(f)
    except Exception:
        return []


async def run(blocks_back=3000, top=40):
    wallets = await discover_wallets(blocks_back=blocks_back, top_n=top)
    if wallets:
        save_wallets(wallets)
    return wallets


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--blocks", type=int, default=3000,
                        help="Blocks to scan back (~3000 = 11 hours)")
    parser.add_argument("--top", type=int, default=40,
                        help="Number of wallets to keep")
    args = parser.parse_args()
    asyncio.run(run(blocks_back=args.blocks, top=args.top))
