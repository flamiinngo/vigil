import React, { useState, useEffect, useRef } from 'react';
import HoneypotBadge from './HoneypotBadge';

const RPC = 'https://ethereum-rpc.publicnode.com';
const SYM_CACHE = {};

async function fetchSymbol(addr) {
  if (!addr || SYM_CACHE[addr] !== undefined) return SYM_CACHE[addr] || null;
  try {
    // ERC20 symbol() selector = 0x95d89b41
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: addr, data: '0x95d89b41' }, 'latest'] }),
    });
    const { result } = await res.json();
    if (!result || result === '0x') { SYM_CACHE[addr] = ''; return null; }
    // ABI-decode string: skip 0x + 32-byte offset + 32-byte length, then UTF-8 bytes
    const hex = result.slice(2);
    const len = parseInt(hex.slice(64, 128), 16);
    const bytes = hex.slice(128, 128 + len * 2);
    const sym = bytes.match(/.{2}/g).map(b => String.fromCharCode(parseInt(b, 16))).join('').replace(/\0/g, '');
    SYM_CACHE[addr] = sym;
    return sym;
  } catch {
    SYM_CACHE[addr] = '';
    return null;
  }
}

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

function timeSince(ts) {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function duration(from, to) {
  if (!from || !to) return '';
  const s = Math.floor(to - from);
  if (s < 60) return `${s}s window`;
  if (s < 3600) return `${Math.floor(s / 60)}m window`;
  return `${Math.floor(s / 3600)}h window`;
}

function short(addr) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : '';
}

function HeatLevel({ count }) {
  const levels = [
    { min: 5, label: 'VERY HOT', color: C.green,  bg: '#05200e', border: '#166534' },
    { min: 3, label: 'HOT',      color: C.yellow, bg: '#1c1408', border: '#78350f' },
    { min: 2, label: 'WARM',     color: C.orange, bg: '#1a0c04', border: '#7c2d12' },
    { min: 0, label: 'WATCHING', color: C.blue,   bg: '#0c1a2e', border: '#1e3a5f' },
  ];
  const level = levels.find(l => count >= l.min);
  return (
    <span style={{
      fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
      color: level.color, background: level.bg,
      border: `1px solid ${level.border}`,
      padding: '2px 7px', borderRadius: '3px',
    }}>
      {level.label}
    </span>
  );
}

function ScoreRing({ score }) {
  const color = score >= 150 ? C.green : score >= 80 ? C.yellow : score >= 40 ? C.orange : C.textDim;
  return (
    <div style={{
      width: '42px', height: '42px', borderRadius: '50%',
      border: `2px solid ${color}40`,
      background: `conic-gradient(${color} ${Math.min(score / 200 * 360, 360)}deg, #1a1a2e 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: '700', color,
      }}>
        {Math.round(score)}
      </div>
    </div>
  );
}

function TokenCard({ token, rank }) {
  const [resolvedSym, setResolvedSym] = useState(token.symbol || null);
  const resolved = useRef(false);

  useEffect(() => {
    if (!token.symbol && !resolved.current) {
      resolved.current = true;
      fetchSymbol(token.token_address).then(s => { if (s) setResolvedSym(s); });
    }
  }, [token.token_address, token.symbol]);

  const sym = resolvedSym ? `$${resolvedSym}` : short(token.token_address);
  const isSignal = token.consensus_reached;
  const multiNode = token.node_count >= 2;

  return (
    <div style={{
      margin: '12px 16px',
      background: isSignal
        ? 'linear-gradient(135deg, #05200e 0%, #0d0d1a 100%)'
        : C.surface,
      border: `1px solid ${isSignal ? '#166534' : C.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
      animation: rank === 1 ? 'slideIn 0.3s ease' : 'none',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = isSignal ? C.green : C.purple + '60'}
      onMouseLeave={e => e.currentTarget.style.borderColor = isSignal ? '#166534' : C.border}
    >
      {/* Card header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ScoreRing score={token.avg_wallet_score || 0} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: isSignal ? C.green : '#a78bfa' }}>{sym}</span>
              {isSignal && multiNode && (
                <span style={{ fontSize: '9px', fontWeight: '700', color: C.green, background: '#05200e', border: '1px solid #166534', padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.1em' }}>✓ VERIFIED SIGNAL</span>
              )}
              {isSignal && !multiNode && (
                <span style={{ fontSize: '9px', fontWeight: '700', color: C.blue, background: '#0c1a2e', border: `1px solid #1e3a5f`, padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.1em' }}>◈ SMART MONEY</span>
              )}
              {!isSignal && <HeatLevel count={token.wallet_count} />}
              <HoneypotBadge address={token.token_address} />
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.textMuted }}>{token.token_address}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: C.textMuted }}>last seen</div>
          <div style={{ fontSize: '12px', color: C.textDim, fontWeight: '600' }}>{timeSince(token.last_seen)}</div>
        </div>
      </div>

      {/* Intelligence summary */}
      <div style={{ padding: '12px 16px', background: '#05050f' }}>
        <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.7' }}>
          <span style={{ color: isSignal ? C.green : C.yellow, fontWeight: '700' }}>
            {token.wallet_count} smart wallet{token.wallet_count !== 1 ? 's' : ''}
          </span>
          {' '}
          {token.wallet_count > 1 ? 'are accumulating' : 'is accumulating'} this token across{' '}
          <span style={{ color: C.purple, fontWeight: '600' }}>
            {token.node_count} independent node{token.node_count !== 1 ? 's' : ''}
          </span>
          {' '}— {token.observation_count} event{token.observation_count !== 1 ? 's' : ''} in a{' '}
          <span style={{ color: C.blue }}>{duration(token.first_seen, token.last_seen) || 'live'}</span>.
          {' '}Average wallet score: <span style={{ color: C.yellow, fontWeight: '600' }}>{token.avg_wallet_score}</span>.
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: `1px solid ${C.border}`,
      }}>
        {[
          { label: 'WALLETS', value: token.wallet_count, color: isSignal ? C.green : C.yellow },
          { label: 'NODES',   value: token.node_count,   color: C.purple },
          { label: 'EVENTS',  value: token.observation_count, color: C.blue },
          { label: 'AVG SCORE', value: token.avg_wallet_score || 0, color: C.orange },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 14px', borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.1em', marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: '8px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <a
          href={`https://dexscreener.com/ethereum/${token.token_address}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: C.textDim, background: C.bg, padding: '5px 12px', borderRadius: '5px', border: `1px solid ${C.border}` }}
        >
          ↗ Chart
        </a>
        <a
          href={`https://etherscan.io/token/${token.token_address}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: C.textDim, background: C.bg, padding: '5px 12px', borderRadius: '5px', border: `1px solid ${C.border}` }}
        >
          ↗ Etherscan
        </a>
        <a
          href={`https://app.uniswap.org/swap?outputCurrency=${token.token_address}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', padding: '5px 14px', borderRadius: '5px', fontWeight: '600', marginLeft: 'auto' }}
        >
          Trade →
        </a>
      </div>
    </div>
  );
}

export default function HotTokens({ tokens }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...tokens].sort((a, b) => {
    if (b.consensus_reached !== a.consensus_reached) return b.consensus_reached - a.consensus_reached;
    return b.wallet_count - a.wallet_count || b.avg_wallet_score - a.avg_wallet_score;
  });
  const display = showAll ? sorted : sorted.slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: C.bg, zIndex: 10,
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: C.text }}>Smart Money Accumulation</span>
          <span style={{ fontSize: '11px', color: C.textDim, marginLeft: '10px' }}>
            Tokens being accumulated before consensus fires
          </span>
        </div>
        <span style={{
          fontSize: '11px', color: C.yellow, background: '#1c1408',
          padding: '3px 12px', borderRadius: '10px', border: `1px solid #78350f40`,
          fontWeight: '600',
        }}>
          {tokens.length} token{tokens.length !== 1 ? 's' : ''} tracked
        </span>
      </div>

      {tokens.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', opacity: 0.1, marginBottom: '16px' }}>◈</div>
          <div style={{ fontSize: '14px', color: C.textDim, marginBottom: '8px' }}>
            Scanning 100 smart wallets across Ethereum mainnet
          </div>
          <div style={{ fontSize: '12px', color: C.textMuted, maxWidth: '360px', margin: '0 auto', lineHeight: '1.6' }}>
            Intelligence appears the moment a tracked wallet accumulates any token.
            Signals fire when 2+ wallets converge on the same token within 20 minutes.
          </div>
        </div>
      ) : (
        <>
          {display.map((t, i) => <TokenCard key={t.token_address} token={t} rank={i + 1} />)}
          {sorted.length > 10 && (
            <div style={{ padding: '16px 24px', textAlign: 'center' }}>
              <button onClick={() => setShowAll(s => !s)} style={{
                background: 'none', color: C.purple, border: `1px solid ${C.purple}40`,
                padding: '8px 20px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              }}>
                {showAll ? 'Show less' : `Show ${sorted.length - 10} more`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
