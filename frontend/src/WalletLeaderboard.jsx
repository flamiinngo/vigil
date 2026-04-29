import React, { useState, useEffect } from 'react';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', yellow: '#f59e0b',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

function short(addr) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : '';
}

function scoreBar(score, max) {
  const pct = Math.min(100, (score / Math.max(max, 1)) * 100);
  const color = pct > 70 ? C.green : pct > 40 ? C.yellow : C.purple;
  return (
    <div style={{ height: '2px', background: C.border, borderRadius: '1px', marginTop: '3px' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '1px' }} />
    </div>
  );
}

export default function WalletLeaderboard() {
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || ''}/wallets.json`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setWallets(Array.isArray(d) ? d.slice(0, 20) : []))
      .catch(() => {});
  }, []);

  if (!wallets.length) return null;
  const maxScore = wallets[0]?.score || 1;

  return (
    <div style={{ margin: '0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: C.textDim, letterSpacing: '0.12em' }}>SMART MONEY WALLETS</span>
        <span style={{ fontSize: '10px', color: C.textMuted }}>{wallets.length} tracked</span>
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {wallets.map((w, i) => (
          <a
            key={w.address}
            href={`https://etherscan.io/address/${w.address}`}
            target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{
              padding: '7px 16px',
              borderBottom: `1px solid ${C.border}`,
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#0f0f20'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontSize: '9px', color: C.textMuted, width: '14px' }}>{i + 1}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: C.textDim }}>{short(w.address)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: C.textMuted }}>{w.pool_diversity}p · {w.swap_count}tx</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: i < 3 ? C.green : i < 7 ? C.yellow : C.purple }}>
                    {w.score}
                  </span>
                </div>
              </div>
              {scoreBar(w.score, maxScore)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
