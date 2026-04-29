import React, { useState, useEffect } from 'react';

const AXL_STATUS_URL = '/axl-status';
const POLL_INTERVAL = 8000;

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
  },
  title: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#94a3b8',
  },
  body: {
    padding: '16px 20px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #0f172a',
    fontSize: '12px',
  },
  label: {
    color: '#475569',
    letterSpacing: '0.06em',
  },
  value: {
    fontWeight: '600',
  },
  onlineTag: {
    color: '#22c55e',
    background: '#052e16',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #166534',
    fontSize: '11px',
  },
  offlineTag: {
    color: '#ef4444',
    background: '#1a0a0a',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #7f1d1d',
    fontSize: '11px',
  },
  componentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    fontSize: '12px',
    color: '#64748b',
  },
  dot: (color) => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
};

function useNodeId() {
  // Extract NODE_ID from the page URL query param for multi-node demo
  const params = new URLSearchParams(window.location.search);
  return params.get('node') || 'vigil-node-1';
}

export default function NodeStatus() {
  const nodeId = useNodeId();
  const [axlOnline, setAxlOnline] = useState(false);
  const [axlPeers, setAxlPeers] = useState(0);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    const check = async () => {
      // Check AXL via server.py proxy (avoids CORS)
      try {
        const res = await fetch(AXL_STATUS_URL, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setAxlOnline(data.online === true);
          setAxlPeers(data.peers || 0);
        } else {
          setAxlOnline(false);
        }
      } catch {
        setAxlOnline(false);
      }

      // Check Ollama
      try {
        const res = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(3000),
        });
        setOllamaOnline(res.ok);
      } catch {
        setOllamaOnline(false);
      }

      setLastCheck(new Date());
    };

    check();
    const iv = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, []);

  const components = [
    { name: 'Ethereum WebSocket', online: true },
    { name: 'Gensyn AXL', online: axlOnline },
    { name: 'Uniswap v3 Data', online: true },
    { name: 'Groq LLM', online: true },
  ];

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>⬡ NODE STATUS</span>
      </div>
      <div style={s.body}>
        <div style={s.row}>
          <span style={s.label}>NODE ID</span>
          <span style={{ ...s.value, color: '#7c3aed', fontSize: '11px' }}>{nodeId}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>NETWORK</span>
          <span style={axlOnline ? s.onlineTag : s.offlineTag}>
            {axlOnline ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        {axlOnline && (
          <div style={s.row}>
            <span style={s.label}>PEERS</span>
            <span style={{ ...s.value, color: '#38bdf8' }}>{axlPeers}</span>
          </div>
        )}
        <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '10px',
          color: '#334155', letterSpacing: '0.1em' }}>
          COMPONENTS
        </div>
        {components.map(c => (
          <div key={c.name} style={s.componentRow}>
            <div style={s.dot(c.online ? '#22c55e' : '#475569')} />
            <span style={{ color: c.online ? '#94a3b8' : '#334155' }}>{c.name}</span>
          </div>
        ))}
        {lastCheck && (
          <div style={{ fontSize: '10px', color: '#1e293b', marginTop: '12px' }}>
            Checked {lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
