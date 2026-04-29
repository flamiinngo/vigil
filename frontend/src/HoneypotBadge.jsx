import React, { useState, useEffect } from 'react';

const C = {
  green: '#22c55e', yellow: '#f59e0b', red: '#ef4444',
  textMuted: '#334155', border: '#1a1a2e', bg: '#070710', surface: '#0d0d1a',
  textDim: '#64748b',
};

// In-memory cache — avoids hitting GoPlus on every render
const CACHE = {};

async function fetchSecurity(address) {
  if (!address) return null;
  const addr = address.toLowerCase();
  if (CACHE[addr] !== undefined) return CACHE[addr];

  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${addr}`
    );
    if (!res.ok) { CACHE[addr] = null; return null; }
    const json = await res.json();
    const data = json?.result?.[addr] || json?.result?.[address] || null;
    CACHE[addr] = data;
    return data;
  } catch {
    CACHE[addr] = null;
    return null;
  }
}

function assess(data) {
  if (!data) return null;

  const honeypot   = data.is_honeypot === '1';
  const sellTax    = parseFloat(data.sell_tax || '0');
  const buyTax     = parseFloat(data.buy_tax  || '0');
  const mintable   = data.is_mintable === '1';
  const takeBack   = data.can_take_back_ownership === '1';
  const pausable   = data.transfer_pausable === '1';
  const openSource = data.is_open_source === '1';

  if (honeypot) return {
    level: 'DANGER',
    color: C.red,
    bg: '#1a0808', border: '#7f1d1d',
    label: '✗ HONEYPOT',
    details: 'Contract flagged as honeypot — cannot sell',
  };

  const warnings = [];
  if (sellTax > 10)  warnings.push(`${(sellTax * 100).toFixed(0)}% sell tax`);
  if (buyTax  > 10)  warnings.push(`${(buyTax  * 100).toFixed(0)}% buy tax`);
  if (mintable)      warnings.push('mintable supply');
  if (takeBack)      warnings.push('ownership reclaimable');
  if (pausable)      warnings.push('transfers pausable');
  if (!openSource)   warnings.push('unverified contract');

  if (warnings.length >= 2) return {
    level: 'CAUTION',
    color: C.yellow,
    bg: '#1c1408', border: '#78350f',
    label: '⚠ CAUTION',
    details: warnings.join(' · '),
  };

  if (warnings.length === 1) return {
    level: 'WARN',
    color: C.yellow,
    bg: '#1c1408', border: '#78350f40',
    label: '⚠ WARN',
    details: warnings[0],
  };

  return {
    level: 'SAFE',
    color: C.green,
    bg: '#052e16', border: '#166534',
    label: '✓ SAFE',
    details: `Open source${sellTax > 0 ? ` · ${(sellTax * 100).toFixed(1)}% sell tax` : ''} · No honeypot`,
  };
}

export default function HoneypotBadge({ address, style = {} }) {
  const [result, setResult] = useState(undefined); // undefined=loading, null=failed
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (!address) return;
    // Check cache immediately (sync)
    const addr = address.toLowerCase();
    if (CACHE[addr] !== undefined) {
      setResult(CACHE[addr]);
      return;
    }
    fetchSecurity(address).then(setResult);
  }, [address]);

  // Still loading
  if (result === undefined) return (
    <span style={{
      fontSize: '9px', color: C.textMuted,
      background: C.surface, border: `1px solid ${C.border}`,
      padding: '2px 7px', borderRadius: '3px',
      letterSpacing: '0.08em', ...style,
    }}>
      checking...
    </span>
  );

  // GoPlus unreachable
  if (result === null) return null;

  const info = assess(result);
  if (!info) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span style={{
        fontSize: '9px', fontWeight: '700', letterSpacing: '0.08em',
        color: info.color, background: info.bg,
        border: `1px solid ${info.border}`,
        padding: '2px 7px', borderRadius: '3px',
        cursor: 'default', whiteSpace: 'nowrap',
      }}>
        {info.label}
      </span>

      {/* Tooltip */}
      {showTip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: '6px',
          background: '#0a0a18', border: `1px solid ${info.border}`,
          borderRadius: '6px', padding: '8px 12px',
          fontSize: '11px', color: info.color,
          whiteSpace: 'nowrap', zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {info.details}
          <div style={{ fontSize: '9px', color: C.textDim, marginTop: '3px' }}>
            via GoPlus Security
          </div>
        </div>
      )}
    </div>
  );
}
