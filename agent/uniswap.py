# uniswap.py — Token data enrichment + on-chain swap execution
#
# Price:     UniswapV3Factory.getPool → slot0 sqrtPriceX96 decoded to USD
# Liquidity: WETH balance of best pool × ETH price × 2
# Volume:    DexScreener (24h historical event aggregation is impractical on free RPCs)
# Swaps:     SwapRouter02 exactInputSingle (auto-swap when SWAP_ENABLED=true)

import asyncio
import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

FACTORY_V3          = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
WETH_ADDRESS        = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
USDC_WETH_POOL      = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"  # 0.05% — ETH/USD ref

SWAP_ENABLED              = os.getenv("SWAP_ENABLED", "false").lower() == "true"
SWAP_BUDGET_ETH           = float(os.getenv("SWAP_BUDGET_ETH", "0.01"))
NODE_OPERATOR_PRIVATE_KEY = os.getenv("NODE_OPERATOR_PRIVATE_KEY", "")
ETH_RPC_URL               = os.getenv("ETH_RPC_URL", "https://eth.llamarpc.com")

FEE_TIERS = [100, 500, 3000, 10000]
_RPCS = [
    os.getenv("ETH_RPC_URL", "https://eth.llamarpc.com"),
    "https://ethereum-rpc.publicnode.com",
    "https://1rpc.io/eth",
]


# ── ABI helpers ───────────────────────────────────────────────────────────────

def _pad_addr(addr: str) -> str:
    return addr.lower().replace("0x", "").zfill(64)

def _pad_uint(n: int) -> str:
    return hex(n)[2:].zfill(64)

def _decode_string(r: str) -> str:
    if not r or r == "0x" or len(r) < 130:
        return ""
    try:
        h = r[2:]
        length = int(h[64:128], 16)
        if length == 0 or length > 64:
            return ""
        return bytes.fromhex(h[128:128 + length * 2]).decode("utf-8", errors="replace").rstrip("\x00")
    except Exception:
        return ""


# ── eth_call wrapper ──────────────────────────────────────────────────────────

async def _call(client: httpx.AsyncClient, to: str, data: str) -> str:
    for url in _RPCS:
        try:
            r = await client.post(url, json={
                "jsonrpc": "2.0", "id": 1,
                "method": "eth_call",
                "params": [{"to": to, "data": data}, "latest"],
            }, timeout=8.0)
            result = r.json().get("result", "0x")
            if result and result != "0x" and not isinstance(result, dict):
                return result
        except Exception:
            continue
    return "0x"


# ── On-chain reads ────────────────────────────────────────────────────────────

async def _erc20_info(client: httpx.AsyncClient, token: str) -> tuple[str, str, int]:
    sym_r  = await _call(client, token, "0x95d89b41")  # symbol()
    name_r = await _call(client, token, "0x06fdde03")  # name()
    dec_r  = await _call(client, token, "0x313ce567")  # decimals()
    decimals = 18
    if dec_r and dec_r != "0x":
        try:
            decimals = int(dec_r, 16)
        except Exception:
            pass
    return _decode_string(sym_r), _decode_string(name_r), decimals


async def _best_pool(client: httpx.AsyncClient, token: str) -> tuple[str | None, int, bool]:
    """
    Call UniswapV3Factory.getPool(tokenA, tokenB, fee) across all fee tiers.
    Pick the pool with the highest in-range liquidity.
    token_is_token0 = True when signal token address < WETH address.
    """
    token_is_token0 = token.lower() < WETH_ADDRESS.lower()
    t0 = token if token_is_token0 else WETH_ADDRESS
    t1 = WETH_ADDRESS if token_is_token0 else token

    best_pool, best_fee, best_liq = None, 3000, 0
    for fee in FEE_TIERS:
        # getPool(address,address,uint24) selector = 0x1698ee82
        data = "0x1698ee82" + _pad_addr(t0) + _pad_addr(t1) + _pad_uint(fee)
        r = await _call(client, FACTORY_V3, data)
        if r == "0x" or len(r) < 42:
            continue
        pool = "0x" + r[-40:]
        if pool == "0x" + "0" * 40:
            continue
        # liquidity() selector = 0x1a686502
        liq_r = await _call(client, pool, "0x1a686502")
        if liq_r == "0x":
            continue
        try:
            liq = int(liq_r, 16)
            if liq > best_liq:
                best_liq, best_pool, best_fee = liq, pool, fee
        except Exception:
            continue

    return best_pool, best_fee, token_is_token0


async def _price_from_slot0(
    client: httpx.AsyncClient,
    pool: str,
    token_is_token0: bool,
    token_decimals: int,
) -> float:
    """
    Read sqrtPriceX96 from slot0() and decode to token price in WETH.

    sqrtPriceX96 is Q64.96: price_raw = (sqrtPriceX96 / 2^96)^2 = token1_raw / token0_raw

    If token is token0 (lower address):
        price_in_weth = price_raw × 10^token_decimals / 10^18

    If token is token1 (higher address):
        price_in_weth = (1 / price_raw) × 10^18 / 10^token_decimals
    """
    r = await _call(client, pool, "0x3850c7bd")  # slot0()
    if r == "0x" or len(r) < 66:
        return 0.0
    try:
        sqrt_price_x96 = int(r[2:66], 16)
        if sqrt_price_x96 == 0:
            return 0.0
        price_raw = (sqrt_price_x96 / (2 ** 96)) ** 2
        if token_is_token0:
            return price_raw * (10 ** token_decimals) / (10 ** 18)
        else:
            if price_raw == 0:
                return 0.0
            return (1.0 / price_raw) * (10 ** 18) / (10 ** token_decimals)
    except Exception:
        return 0.0


async def _eth_price_usd(client: httpx.AsyncClient) -> float:
    """
    Derive ETH/USD from USDC/WETH 0.05% pool slot0.
    USDC = token0 (6 dec, lower address), WETH = token1 (18 dec).
    price_raw = WETH_raw / USDC_raw → ETH price = (1/price_raw) × 10^12
    """
    r = await _call(client, USDC_WETH_POOL, "0x3850c7bd")
    if r == "0x" or len(r) < 66:
        return 3000.0
    try:
        sqrt_price_x96 = int(r[2:66], 16)
        price_raw = (sqrt_price_x96 / (2 ** 96)) ** 2
        eth_usd = (1.0 / price_raw) * (10 ** 12)
        return eth_usd if 100 < eth_usd < 100_000 else 3000.0
    except Exception:
        return 3000.0


async def _pool_liquidity_usd(
    client: httpx.AsyncClient,
    pool: str,
    eth_price: float,
) -> float:
    """
    Estimate pool TVL: read WETH balance of pool via WETH.balanceOf(pool).
    TVL ≈ WETH balance × ETH price × 2 (both sides of pair).
    """
    data = "0x70a08231" + _pad_addr(pool)  # balanceOf(address)
    r = await _call(client, WETH_ADDRESS, data)
    if r == "0x":
        return 0.0
    try:
        return (int(r, 16) / (10 ** 18)) * eth_price * 2
    except Exception:
        return 0.0


# ── Public API ────────────────────────────────────────────────────────────────

async def get_token_data(token_address: str) -> dict:
    """
    Enrich a signal token with live Uniswap v3 on-chain data.

    Price and liquidity come directly from Uniswap v3 pool contracts.
    24h volume comes from DexScreener — computing it from Swap events
    requires scanning thousands of blocks per call, impractical in real time.
    """
    token = token_address.lower()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            (symbol, name, decimals), (pool, fee, token_is_token0) = await asyncio.gather(
                _erc20_info(client, token),
                _best_pool(client, token),
            )

            price_usd = liquidity_usd = volume_24h_usd = 0.0

            if pool:
                eth_price, price_in_weth = await asyncio.gather(
                    _eth_price_usd(client),
                    _price_from_slot0(client, pool, token_is_token0, decimals),
                )
                price_usd     = price_in_weth * eth_price
                liquidity_usd = await _pool_liquidity_usd(client, pool, eth_price)

            # 24h volume from DexScreener — prefer Uniswap pairs
            try:
                resp = await client.get(
                    f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
                    timeout=5.0,
                )
                pairs = resp.json().get("pairs") or []
                uni = [p for p in pairs if "uniswap" in (p.get("dexId") or "").lower()]
                if uni or pairs:
                    best = max(uni or pairs, key=lambda p: float((p.get("liquidity") or {}).get("usd") or 0))
                    volume_24h_usd = float((best.get("volume") or {}).get("h24") or 0)
                    if not symbol:
                        symbol = (best.get("baseToken") or best.get("quoteToken") or {}).get("symbol", "")
                    if not name:
                        name = (best.get("baseToken") or best.get("quoteToken") or {}).get("name", "")
            except Exception:
                pass

            print(f"[UNISWAP] {symbol or token[:10]} — "
                  f"${price_usd:.6f} | pool {(pool or 'none')[:10]}... fee={fee} | "
                  f"liq ${liquidity_usd:,.0f} | vol24h ${volume_24h_usd:,.0f}")

            return {
                "token_address":        token_address,
                "symbol":               symbol,
                "name":                 name,
                "price_usd":            round(price_usd, 8),
                "liquidity_usd":        round(liquidity_usd, 2),
                "volume_24h_usd":       round(volume_24h_usd, 2),
                "price_change_24h_pct": 0.0,
                "best_pool":            pool,
                "swap_url":             _swap_url(token_address),
                "fetched_at":           int(time.time()),
            }

    except Exception as e:
        print(f"[UNISWAP] Data fetch failed for {token_address[:10]}...: {e}")
        return _empty(token_address)


async def execute_swap(token_address: str, amount_eth: float = None) -> dict | None:
    """
    Execute ETH → token swap via Uniswap v3 SwapRouter02 exactInputSingle.
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

        account    = w3.eth.account.from_key(NODE_OPERATOR_PRIVATE_KEY)
        amount_wei = w3.to_wei(eth_amount, "ether")

        ROUTER_ABI = [{
            "name": "exactInputSingle",
            "type": "function",
            "stateMutability": "payable",
            "inputs": [{"name": "params", "type": "tuple", "components": [
                {"name": "tokenIn",           "type": "address"},
                {"name": "tokenOut",          "type": "address"},
                {"name": "fee",               "type": "uint24"},
                {"name": "recipient",         "type": "address"},
                {"name": "amountIn",          "type": "uint256"},
                {"name": "amountOutMinimum",  "type": "uint256"},
                {"name": "sqrtPriceLimitX96", "type": "uint160"},
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
