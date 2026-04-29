# uniswap.py — Token data enrichment + on-chain swap execution
#
# Data:  DexScreener public API — no API key, no signup, completely free
#        https://api.dexscreener.com/latest/dex/tokens/{address}
#
# Swaps: Uniswap v3 SwapRouter02 — 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
#        Set SWAP_ENABLED=true and NODE_OPERATOR_PRIVATE_KEY in .env to enable

import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
WETH_ADDRESS        = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

SWAP_ENABLED             = os.getenv("SWAP_ENABLED", "false").lower() == "true"
SWAP_BUDGET_ETH          = float(os.getenv("SWAP_BUDGET_ETH", "0.01"))
NODE_OPERATOR_PRIVATE_KEY = os.getenv("NODE_OPERATOR_PRIVATE_KEY", "")
ETH_RPC_URL              = os.getenv("ETH_RPC_URL", "https://eth.llamarpc.com")


async def get_token_data(token_address: str) -> dict:
    """
    Fetch live token market data from DexScreener.
    Returns price, liquidity, 24h volume, price change, and a Uniswap swap URL.
    No API key required.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        pairs = data.get("pairs") or []
        if not pairs:
            print(f"[UNISWAP] No pairs found for {token_address[:10]}...")
            return _empty(token_address)

        # Prefer Uniswap pairs; fall back to highest liquidity overall
        uni_pairs = [p for p in pairs if "uniswap" in (p.get("dexId") or "").lower()]
        best = max(
            uni_pairs or pairs,
            key=lambda p: float((p.get("liquidity") or {}).get("usd") or 0),
        )

        base  = best.get("baseToken")  or {}
        quote = best.get("quoteToken") or {}
        is_base = (base.get("address") or "").lower() == token_address.lower()
        info  = base if is_base else quote

        symbol          = info.get("symbol", "")
        name            = info.get("name", "")
        price_usd       = float(best.get("priceUsd") or 0)
        liquidity_usd   = float((best.get("liquidity") or {}).get("usd") or 0)
        volume_24h      = float((best.get("volume")   or {}).get("h24") or 0)
        price_change_24h = float((best.get("priceChange") or {}).get("h24") or 0)

        print(f"[UNISWAP] {symbol or token_address[:10]} — "
              f"${price_usd:.6f} | "
              f"liq ${liquidity_usd:,.0f} | "
              f"vol24h ${volume_24h:,.0f} | "
              f"{price_change_24h:+.1f}%")

        return {
            "token_address":       token_address,
            "symbol":              symbol,
            "name":                name,
            "price_usd":           round(price_usd, 8),
            "liquidity_usd":       round(liquidity_usd, 2),
            "volume_24h_usd":      round(volume_24h, 2),
            "price_change_24h_pct": price_change_24h,
            "best_pool":           best.get("pairAddress"),
            "swap_url":            _swap_url(token_address),
            "fetched_at":          int(time.time()),
        }

    except Exception as e:
        print(f"[UNISWAP] Data fetch failed for {token_address[:10]}...: {e}")
        return _empty(token_address)


async def execute_swap(token_address: str, amount_eth: float = None) -> dict | None:
    """
    Execute ETH → token swap via Uniswap v3 SwapRouter02.
    Only runs when SWAP_ENABLED=true and NODE_OPERATOR_PRIVATE_KEY is set.
    """
    if not SWAP_ENABLED:
        return None
    if not NODE_OPERATOR_PRIVATE_KEY:
        print("[UNISWAP] SWAP_ENABLED=true but NODE_OPERATOR_PRIVATE_KEY not set")
        return None

    eth_amount = amount_eth or SWAP_BUDGET_ETH
    print(f"[UNISWAP] Swapping {eth_amount} ETH → {token_address[:12]}...")

    try:
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(ETH_RPC_URL))
        if not w3.is_connected():
            print(f"[UNISWAP] Cannot connect to {ETH_RPC_URL}")
            return None

        account  = w3.eth.account.from_key(NODE_OPERATOR_PRIVATE_KEY)
        amount_wei = w3.to_wei(eth_amount, "ether")
        deadline   = int(time.time()) + 300

        ROUTER_ABI = [{
            "name": "exactInputSingle",
            "type": "function",
            "stateMutability": "payable",
            "inputs": [{"name": "params", "type": "tuple", "components": [
                {"name": "tokenIn",            "type": "address"},
                {"name": "tokenOut",           "type": "address"},
                {"name": "fee",                "type": "uint24"},
                {"name": "recipient",          "type": "address"},
                {"name": "amountIn",           "type": "uint256"},
                {"name": "amountOutMinimum",   "type": "uint256"},
                {"name": "sqrtPriceLimitX96",  "type": "uint160"},
            ]}],
            "outputs": [{"name": "amountOut", "type": "uint256"}],
        }]

        router = w3.eth.contract(
            address=Web3.to_checksum_address(SWAP_ROUTER_ADDRESS),
            abi=ROUTER_ABI,
        )

        tx = router.functions.exactInputSingle({
            "tokenIn":           Web3.to_checksum_address(WETH_ADDRESS),
            "tokenOut":          Web3.to_checksum_address(token_address),
            "fee":               3000,
            "recipient":         account.address,
            "amountIn":          amount_wei,
            "amountOutMinimum":  0,
            "sqrtPriceLimitX96": 0,
        }).build_transaction({
            "from":  account.address,
            "value": amount_wei,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas":   300_000,
        })

        signed  = w3.eth.account.sign_transaction(tx, NODE_OPERATOR_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status == 1:
            print(f"[UNISWAP] Swap confirmed — tx: {tx_hash.hex()[:20]}...")
            return {"tx_hash": tx_hash.hex(), "amount_eth": eth_amount,
                    "block": receipt.blockNumber, "executed": True}

        print("[UNISWAP] Swap reverted")
        return None

    except ImportError:
        print("[UNISWAP] Install web3: pip install web3")
        return None
    except Exception as e:
        print(f"[UNISWAP] Swap error: {e}")
        return None


def _swap_url(token_address: str) -> str:
    return (f"https://app.uniswap.org/swap"
            f"?inputCurrency=ETH&outputCurrency={token_address}&chain=mainnet")


def _empty(token_address: str) -> dict:
    return {
        "token_address":        token_address,
        "symbol":               "",
        "name":                 "",
        "price_usd":            0.0,
        "liquidity_usd":        0.0,
        "volume_24h_usd":       0.0,
        "price_change_24h_pct": 0.0,
        "best_pool":            None,
        "swap_url":             _swap_url(token_address),
        "fetched_at":           int(time.time()),
    }
