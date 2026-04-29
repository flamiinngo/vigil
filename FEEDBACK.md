# Uniswap Integration Feedback — Vigil

## What we built with Uniswap

Vigil is a decentralized on-chain intelligence network. Every verified signal is enriched with live Uniswap v3 data and includes a direct swap link so users can act on signals instantly.

### How Uniswap v3 is used

**1. Wallet Discovery (discover.py)**
We scan Uniswap v3 Swap events (`eth_getLogs`) across 18 top pools to discover and score smart money wallets. A wallet that trades across many different Uniswap v3 pools (USDC/WETH, WBTC/WETH, LINK/WETH, UNI/WETH, stETH/WETH, etc.) scores higher — pool diversity is a strong proxy for sophisticated on-chain traders.

Pools scanned: USDC/WETH 0.05%, USDC/WETH 0.3%, USDT/WETH 0.05%, USDT/WETH 0.3%, WBTC/WETH 0.3%, WBTC/WETH 0.05%, WBTC/USDC, stETH/WETH, LINK/WETH, UNI/WETH, MKR/WETH, AAVE/WETH, CRV/WETH, MATIC/WETH, PEPE/WETH, SHIB/WETH, DAI/USDC, DAI/WETH

**2. Signal Enrichment (uniswap.py)**
When consensus fires, we enrich every signal token with live Uniswap v3 on-chain data:
- Best pool — UniswapV3Factory.getPool(token, WETH, fee) across all four fee tiers (100/500/3000/10000); highest in-range liquidity wins
- Current price (USD) — decoded from pool slot0 sqrtPriceX96 (Q64.96 fixed point → WETH price → USD via USDC/WETH reference pool)
- Liquidity (USD) — WETH.balanceOf(pool) × ETH price × 2; signals below $5k dropped
- 24h volume (USD) — DexScreener (computing 24h volume from Swap events requires scanning thousands of blocks per call — impractical in real time on free RPCs)
- Pool address returned with every signal so users can verify on-chain

**3. Direct Swap Links**
Every verified signal includes a pre-built Uniswap swap URL:
```
https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency={token}&chain=mainnet
```
Users can act on intelligence immediately without leaving the dashboard.

**4. Auto-Swap (optional)**
When `SWAP_ENABLED=true`, Vigil executes ETH → token swaps via Uniswap v3 SwapRouter02 (`exactInputSingle`) using the operator's configured budget.

## What we'd build next with Uniswap

- **v4 hooks integration** — fire a hook when a consensus signal is reached, enabling on-chain reaction to decentralized intelligence
- **Liquidity flow analysis** — detect when smart money adds/removes liquidity (not just swaps)
- **Pool creation alerts** — detect new Uniswap v3 pool deployments and watch early liquidity providers

## Pain points encountered

- Pool addresses for smaller pairs aren't easily discoverable without an indexer — a Uniswap v3 pool registry endpoint or subgraph would help
- `eth_getLogs` with large block ranges requires chunking (2000 blocks max on free RPCs) — a Uniswap-hosted event streaming endpoint would make this significantly faster
