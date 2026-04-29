import React, { useState, useEffect } from 'react';

const RPC = 'https://ethereum.publicnode.com';

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json();
  return d.result;
}

export default function MarketBar() {
  const [gas, setGas]     = useState(null);
  const [block, setBlock] = useState(null);
  const [ethPrice, setEthPrice] = useState(null);

  useEffect(() => {
    async function fetchChainData() {
      try {
        const [gasHex, blockHex] = await Promise.all([
          rpc('eth_gasPrice'),
          rpc('eth_blockNumber'),
        ]);
        setGas(Math.round(parseInt(gasHex, 16) / 1e9));
        setBlock(parseInt(blockHex, 16));
      } catch (_) {}
    }

    async function fetchEthPrice() {
      try {
        // Use Uniswap USDC/WETH pool to get live ETH price
        // quoteExactInputSingle: 1 WETH → USDC (fee 500)
        const QUOTER = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
        const WETH   = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        const USDC   = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        // ABI-encode quoteExactInputSingle params struct
        // (tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96)
        const pad = (hex, len) => hex.replace('0x', '').padStart(len, '0');
        const amountIn = (10n ** 18n).toString(16);
        const data = '0xc6a5026a' +
          pad(WETH.toLowerCase(), 64) +
          pad(USDC.toLowerCase(), 64) +
          pad(amountIn, 64) +
          pad((500).toString(16), 64) +
          '0'.repeat(64);
        const result = await rpc('eth_call', [{ to: QUOTER, data }, 'latest']);
        if (result && result !== '0x') {
          const price = parseInt(result.slice(0, 66), 16) / 1e6;
          if (price > 100 && price < 1000000) setEthPrice(price);
        }
      } catch (_) {}
    }

    fetchChainData();
    fetchEthPrice();
    const interval = setInterval(fetchChainData, 12000); // every block
    const priceInterval = setInterval(fetchEthPrice, 30000);
    return () => { clearInterval(interval); clearInterval(priceInterval); };
  }, []);

  const items = [
    { label: 'ETH', value: ethPrice ? `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '...', color: '#a78bfa' },
    { label: 'GAS', value: gas ? `${gas} gwei` : '...', color: gas > 30 ? '#ef4444' : gas > 15 ? '#f59e0b' : '#22c55e' },
    { label: 'BLOCK', value: block ? `#${block.toLocaleString()}` : '...', color: '#38bdf8' },
    { label: 'NETWORK', value: 'ETHEREUM', color: '#64748b' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0',
      borderBottom: '1px solid #1a1a2e', background: '#050508',
      overflowX: 'auto', flexShrink: 0,
    }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 20px', borderRight: '1px solid #1a1a2e',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.12em' }}>{item.label}</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ padding: '6px 20px', fontSize: '9px', color: '#334155', letterSpacing: '0.1em' }}>
        VIGIL INTELLIGENCE TERMINAL · GENSYN AXL NETWORK
      </div>
    </div>
  );
}
