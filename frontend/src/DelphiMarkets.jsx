import React from 'react';

const s = {
  container: {
    background: '#0d0d18',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 20px',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#94a3b8',
  },
  count: {
    fontSize: '11px',
    color: '#f59e0b',
    background: '#1c1408',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #78350f',
  },
  empty: {
    padding: '30px 20px',
    textAlign: 'center',
    color: '#1e293b',
    fontSize: '12px',
  },
  marketCard: {
    padding: '14px 20px',
    borderBottom: '1px solid #0f172a',
    animation: 'fadeIn 0.4s ease',
  },
  tokenLine: {
    fontSize: '12px',
    color: '#f59e0b',
    fontFamily: 'monospace',
    marginBottom: '6px',
  },
  question: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  link: {
    display: 'inline-block',
    fontSize: '11px',
    color: '#f59e0b',
    textDecoration: 'none',
    borderBottom: '1px solid #78350f',
  },
  earningsBadge: {
    fontSize: '10px',
    color: '#22c55e',
    marginTop: '6px',
  },
};

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function MarketCard({ signal }) {
  return (
    <div style={s.marketCard}>
      <div style={s.tokenLine}>◆ {truncateAddress(signal.token_address)}</div>
      <div style={s.question}>
        Will this token be up 20% in 48h?<br />
        {signal.node_count} node{signal.node_count !== 1 ? 's' : ''} ·{' '}
        confidence {signal.combined_confidence}
      </div>
      <a
        href={signal.delphi_market_url}
        target="_blank"
        rel="noopener noreferrer"
        style={s.link}
      >
        Open market →
      </a>
      <div style={s.earningsBadge}>1.5% volume fee → node operator</div>
    </div>
  );
}

export default function DelphiMarkets({ signals }) {
  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>◆ DELPHI MARKETS</span>
        <span style={s.count}>{signals.length} active</span>
      </div>
      {signals.length === 0 ? (
        <div style={s.empty}>
          Markets appear when<br />consensus fires
        </div>
      ) : (
        signals.map((sig, i) => <MarketCard key={sig.id || i} signal={sig} />)
      )}
    </div>
  );
}
