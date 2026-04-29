import React, { useRef, useEffect } from 'react';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function short(addr) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : '';
}

const KNOWN_TOKENS = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINK',
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNI',
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'AAVE',
  '0xd533a949740bb3306d119cc777fa900ba034cd52': 'CRV',
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'MKR',
  '0x6810e776880c02933d47db1b9fc05908e5386b96': 'GNO',
  '0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24': 'RNDR',
  '0xaea46a60368a7bd060eec7df8cba43b7ef41ad85': 'FET',
  '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b': 'AXS',
};

function tokenLabel(addr) {
  const sym = KNOWN_TOKENS[addr?.toLowerCase()];
  return sym ? `$${sym}` : short(addr);
}

function scoreColor(score) {
  if (score >= 150) return C.green;
  if (score >= 80)  return C.yellow;
  if (score >= 40)  return C.orange;
  return C.textDim;
}

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  return (
    <div style={{
      fontSize: '10px', fontWeight: '700', color,
      background: color + '18', border: `1px solid ${color}40`,
      padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap',
    }}>
      {score > 0 ? `★ ${score}` : '—'}
    </div>
  );
}

export default function LiveFeed({ activities, hotTokens }) {
  const listRef = useRef(null);
  const prevLen = useRef(0);

  // Don't auto-scroll if user has scrolled up
  useEffect(() => {
    if (activities.length > prevLen.current && listRef.current) {
      const el = listRef.current;
      if (el.scrollTop < 40) el.scrollTop = 0;
    }
    prevLen.current = activities.length;
  }, [activities.length]);

  const inbound  = activities.filter(a => a.direction === 'inbound').length;
  const outbound = activities.filter(a => a.direction === 'outbound').length;
  const uniqueWallets = new Set(activities.map(a => a.wallet)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: C.bg, zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.green, animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: C.text }}>Live Wallet Activity</span>
          <span style={{ fontSize: '11px', color: C.textDim }}>Real-time smart money movements</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'EVENTS', value: activities.length, color: C.blue },
            { label: 'WALLETS', value: uniqueWallets, color: C.purple },
            { label: '▲ IN', value: inbound, color: C.green },
            { label: '▼ OUT', value: outbound, color: C.orange },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '52px 140px 1fr 80px 70px 70px',
        gap: '8px', padding: '7px 24px', background: C.surface,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {['DIR', 'WALLET', 'TOKEN', 'SCORE', 'NODE', 'WHEN'].map(h => (
          <div key={h} style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.12em' }}>{h}</div>
        ))}
      </div>

      {/* Feed */}
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {activities.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <ScanAnimation />
            <div style={{ fontSize: '13px', color: C.textDim, marginTop: '20px' }}>Scanning 100 smart wallets on Ethereum mainnet...</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '6px' }}>First movements appear within seconds of a watched wallet transacting</div>
          </div>
        ) : (
          activities.map((a, i) => (
            <ActivityRow key={`${a.tx_hash}-${i}`} activity={a} isNew={i === 0} />
          ))
        )}
      </div>

      {/* Hot tokens mini strip at bottom */}
      {hotTokens.length > 0 && (
        <div style={{
          borderTop: `1px solid ${C.border}`, padding: '8px 24px',
          background: C.surface, flexShrink: 0,
          display: 'flex', gap: '16px', alignItems: 'center', overflowX: 'auto',
        }}>
          <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.1em', flexShrink: 0 }}>ACCUMULATING NOW</span>
          {hotTokens.slice(0, 8).map(t => (
            <div key={t.token_address} style={{
              display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
              background: t.consensus_reached ? '#05200e' : C.bg,
              border: `1px solid ${t.consensus_reached ? '#166534' : C.border}`,
              borderRadius: '5px', padding: '3px 10px',
            }}>
              {t.consensus_reached && <span style={{ color: C.green, fontSize: '9px' }}>✓</span>}
              <span style={{ fontSize: '12px', fontWeight: '600', color: t.consensus_reached ? C.green : '#a78bfa' }}>
                {t.symbol ? `$${t.symbol}` : short(t.token_address)}
              </span>
              <span style={{ fontSize: '10px', color: C.textDim }}>{t.wallet_count}w</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity: a, isNew }) {
  const isIn = a.direction === 'inbound';
  const nodeShort = a.node_id?.replace('vigil-', '') || '—';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '52px 140px 1fr 80px 70px 70px',
      gap: '8px', padding: '9px 24px',
      borderBottom: `1px solid ${C.border}`,
      background: isNew ? (isIn ? 'rgba(34,197,94,0.04)' : 'rgba(249,115,22,0.03)') : 'transparent',
      animation: isNew ? 'slideIn 0.25s ease' : 'none',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#0f0f20'}
      onMouseLeave={e => e.currentTarget.style.background = isNew ? (isIn ? 'rgba(34,197,94,0.04)' : 'rgba(249,115,22,0.03)') : 'transparent'}
    >
      {/* Direction */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        fontSize: '11px', fontWeight: '700',
        color: isIn ? C.green : C.orange,
      }}>
        <span style={{ fontSize: '10px' }}>{isIn ? '▲' : '▼'}</span>
        <span>{isIn ? 'IN' : 'OUT'}</span>
      </div>

      {/* Wallet */}
      <a
        href={`https://etherscan.io/address/${a.wallet}`}
        target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'monospace', fontSize: '11px', color: C.textDim, textDecoration: 'none' }}
        onMouseEnter={e => e.target.style.color = C.purple}
        onMouseLeave={e => e.target.style.color = C.textDim}
      >
        {short(a.wallet)}
      </a>

      {/* Token */}
      <a
        href={`https://dexscreener.com/ethereum/${a.token_address}`}
        target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ fontSize: '12px', fontWeight: '600', color: '#a78bfa', textDecoration: 'none' }}
        onMouseEnter={e => e.target.style.color = '#c4b5fd'}
        onMouseLeave={e => e.target.style.color = '#a78bfa'}
      >
        {a.symbol ? `$${a.symbol}` : tokenLabel(a.token_address)}
      </a>

      {/* Score */}
      <div><ScoreBadge score={a.score} /></div>

      {/* Node */}
      <div style={{ fontSize: '10px', color: C.purple, fontWeight: '600' }}>{nodeShort}</div>

      {/* Time */}
      <div style={{ fontSize: '10px', color: C.textMuted }}>{timeAgo(a.timestamp)}</div>
    </div>
  );
}

function ScanAnimation() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: '3px', height: `${12 + i * 6}px`,
          background: C.purple, borderRadius: '2px',
          opacity: 0.4,
          animation: `pulse 1.2s ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  );
}
