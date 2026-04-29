import React, { useState } from 'react';
import SwapModal from './SwapModal';
import HoneypotBadge from './HoneypotBadge';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

function fmt(n) {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function short(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

function confidenceColor(c) {
  if (c >= 160) return C.green;
  if (c >= 120) return C.yellow;
  return C.orange;
}

// Group an array of signals by token_address, returning one entry per token
// with the latest signal as the "primary" and all signals as history.
function groupByToken(signals) {
  const map = {};
  for (const s of signals) {
    const addr = s.token_address;
    if (!map[addr]) {
      map[addr] = { primary: s, history: [s] };
    } else {
      map[addr].history.push(s);
      if ((s.timestamp || 0) > (map[addr].primary.timestamp || 0)) {
        map[addr].primary = s;
      }
    }
  }
  return Object.values(map).sort(
    (a, b) => (b.primary.timestamp || 0) - (a.primary.timestamp || 0)
  );
}

function SignalCard({ group, isNew, wallet }) {
  const { primary: signal, history } = group;
  const [expanded, setExpanded] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [hovered, setHovered] = useState(false);

  const uni = signal.uniswap || {};
  const conf = signal.confidence || 0;
  const color = confidenceColor(conf);
  const sym = uni.symbol ? `$${uni.symbol}` : short(signal.token_address);
  const chg = uni.price_change_24h_pct;
  const price = uni.price_usd;
  const multiCount = history.length;

  // Collect all unique confirming nodes across all signals for this token
  const allNodes = [...new Set(history.flatMap(s => s.node_ids || []))];

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 24px',
        cursor: 'pointer',
        animation: isNew ? 'slideIn 0.4s ease' : 'none',
        background: isNew
          ? 'linear-gradient(135deg, #0f0820 0%, #0d0d1a 60%)'
          : 'transparent',
        borderLeft: isNew ? `3px solid ${C.purple}` : '3px solid transparent',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#0f0f20'; setHovered(true); }}
      onMouseLeave={e => { e.currentTarget.style.background = isNew ? 'linear-gradient(135deg, #0f0820 0%, #0d0d1a 60%)' : 'transparent'; setHovered(false); }}
    >
      {/* Row 1: Token + price + change + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#1a1030', border: `1px solid ${C.purple}40`,
            borderRadius: '6px', padding: '4px 10px',
            fontSize: '14px', fontWeight: '700', color: '#a78bfa',
          }}>{sym}</div>
          {price > 0 && (
            <span style={{ fontSize: '15px', fontWeight: '700', color: C.text }}>
              ${price < 0.01 ? price.toFixed(6) : price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          )}
          {chg != null && (
            <span style={{
              fontSize: '13px', fontWeight: '600',
              color: chg >= 0 ? C.green : C.red,
              background: chg >= 0 ? '#052e1620' : '#1a080820',
              padding: '2px 7px', borderRadius: '4px',
            }}>
              {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
            </span>
          )}
          {/* Signal count badge — shown when this token fired multiple times */}
          {multiCount > 1 && (
            <span style={{
              fontSize: '10px', fontWeight: '700', color: C.yellow,
              background: '#1c1408', border: `1px solid #78350f`,
              padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.08em',
            }}>
              {multiCount} signals
            </span>
          )}
          <HoneypotBadge address={signal.token_address} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {allNodes.length >= 2 ? (
            <span style={{
              fontSize: '10px', color: C.green, background: '#052e16',
              padding: '3px 8px', borderRadius: '4px', border: `1px solid #166534`,
              fontWeight: '700', letterSpacing: '0.1em',
            }}>✓ MULTI-NODE</span>
          ) : (
            <span style={{
              fontSize: '10px', color: C.blue, background: '#0c1a2e',
              padding: '3px 8px', borderRadius: '4px', border: `1px solid #1e3a5f`,
              fontWeight: '700', letterSpacing: '0.1em',
            }}>◈ SMART MONEY</span>
          )}
          <span style={{ fontSize: '11px', color: C.textMuted }}>{timeAgo(signal.timestamp)}</span>
        </div>
      </div>

      {/* Row 2: Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
        {[
          { label: 'CONFIDENCE', value: `${conf}/200`, color },
          { label: 'NODES',      value: allNodes.length || signal.node_count || 0, color: C.purple },
          { label: 'LIQUIDITY',  value: fmt(uni.liquidity_usd), color: C.yellow },
          { label: '24H VOLUME', value: fmt(uni.volume_24h_usd), color: C.blue },
        ].map(m => (
          <div key={m.label} style={{ background: C.bg, borderRadius: '6px', padding: '8px 10px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.1em', marginBottom: '3px' }}>{m.label}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Confidence bar */}
      <div style={{ height: '3px', background: C.border, borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (conf / 200) * 100)}%`, background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
      </div>

      {/* Latest narrative */}
      {signal.narrative && (
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', lineHeight: '1.6', fontStyle: 'italic' }}>
          "{signal.narrative}"
        </div>
      )}

      {/* Confirmed by — all nodes across all signals */}
      {allNodes.length > 0 && (
        <div style={{ fontSize: '11px', color: C.purple, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: C.textMuted }}>Confirmed by:</span>
          {allNodes.map(n => (
            <span key={n} style={{ background: '#1a1030', border: `1px solid ${C.purple}40`, padding: '1px 6px', borderRadius: '3px' }}>{n}</span>
          ))}
        </div>
      )}

      {/* Signal history — shown when multiple signals exist */}
      {multiCount > 1 && (
        <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: C.purple }}>▾</span>
          {expanded ? 'Hide' : 'Show'} signal history ({multiCount - 1} earlier)
        </div>
      )}

      {/* Actions — revealed on hover */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap',
        maxHeight: hovered || expanded ? '40px' : '0',
        overflow: 'hidden',
        opacity: hovered || expanded ? 1 : 0,
        transition: 'max-height 0.2s ease, opacity 0.2s ease',
        marginTop: hovered || expanded ? '10px' : '0',
      }}>
        <button
          onClick={e => { e.stopPropagation(); setShowSwap(true); }}
          style={{
            fontSize: '12px', color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            padding: '6px 14px', borderRadius: '6px', fontWeight: '600', border: 'none',
            display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
          }}>
          ⇄ Swap {uni.symbol ? `$${uni.symbol}` : ''}
        </button>
        <a href={`https://etherscan.io/token/${signal.token_address}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: '12px', color: C.textDim, background: C.bg, padding: '6px 14px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
          ↗ Etherscan
        </a>
        <a href={`https://dexscreener.com/ethereum/${signal.token_address}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: '12px', color: C.textDim, background: C.bg, padding: '6px 14px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
          ↗ Chart
        </a>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '14px' }}>

          {/* Signal history */}
          {multiCount > 1 && (
            <div style={{ marginBottom: '12px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.12em', padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>SIGNAL HISTORY</div>
              {history.map((s, i) => (
                <div key={s.id || i} style={{
                  padding: '9px 12px',
                  borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <span style={{ fontSize: '9px', color: C.textMuted, whiteSpace: 'nowrap', marginTop: '2px', minWidth: '52px' }}>{timeAgo(s.timestamp)}</span>
                  <div>
                    {s.narrative && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', lineHeight: '1.5', marginBottom: '4px' }}>"{s.narrative}"</div>
                    )}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {(s.node_ids || []).map(n => (
                        <span key={n} style={{ fontSize: '9px', color: C.purple, background: '#1a1030', border: `1px solid ${C.purple}30`, padding: '1px 5px', borderRadius: '3px' }}>{n}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Wallet list */}
          {signal.wallets && signal.wallets.length > 0 && (
            <div style={{ background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.1em', padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>SMART MONEY WALLETS</div>
              {signal.wallets.map(w => (
                <div key={w} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: C.textDim }}>{w}</span>
                  <a href={`https://etherscan.io/address/${w}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '10px', color: C.purple }}>View →</a>
                </div>
              ))}
              <div style={{ fontSize: '10px', color: C.textMuted, padding: '6px 12px' }}>Signal ID: {signal.id}</div>
            </div>
          )}
        </div>
      )}

      {showSwap && (
        <SwapModal signal={signal} wallet={wallet} onClose={() => setShowSwap(false)} />
      )}
    </div>
  );
}

export default function SignalFeed({ signals, total, wallet }) {
  const grouped = groupByToken(signals);

  return (
    <div>
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: '#070710', zIndex: 10,
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: C.text }}>Verified Signals</span>
          <span style={{ fontSize: '11px', color: C.textDim, marginLeft: '8px' }}>
            Consensus confirmed by 2+ independent nodes
          </span>
        </div>
        <span style={{
          fontSize: '11px', color: C.purple, background: '#1a1030',
          padding: '3px 10px', borderRadius: '10px', border: `1px solid ${C.purple}40`,
        }}>
          {grouped.length} token{grouped.length !== 1 ? 's' : ''}
          {signals.length > grouped.length && <span style={{ color: C.textMuted }}> · {signals.length} signals</span>}
          {total !== signals.length && <span style={{ color: C.textMuted }}> / {total} total</span>}
        </span>
      </div>

      {grouped.length === 0 ? (
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.15 }}>◈</div>
          <div style={{ fontSize: '14px', color: C.textDim, marginBottom: '8px' }}>Watching for smart money signals...</div>
          <div style={{ fontSize: '12px', color: C.textMuted }}>
            Consensus requires 2+ independent wallets · Stablecoins filtered
          </div>
        </div>
      ) : (
        grouped.map((g, i) => (
          <SignalCard key={g.primary.token_address} group={g} isNew={i === 0} wallet={wallet} />
        ))
      )}
    </div>
  );
}
