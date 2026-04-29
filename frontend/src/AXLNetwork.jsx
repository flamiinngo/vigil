import React, { useState, useEffect, useRef } from 'react';

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

function NodeCard({ node, side }) {
  const isLeft = side === 'left';
  const online = node.online;
  return (
    <div style={{
      width: '200px', flexShrink: 0,
      background: online
        ? 'linear-gradient(135deg, #0a0520 0%, #0d0d1a 100%)'
        : C.surface,
      border: `1px solid ${online ? C.purple + '50' : C.border}`,
      borderRadius: '12px', padding: '18px 16px',
      textAlign: isLeft ? 'left' : 'right',
      position: 'relative', overflow: 'hidden',
    }}>
      {online && (
        <div style={{
          position: 'absolute', top: 0, [isLeft ? 'left' : 'right']: 0,
          width: '80px', height: '80px', borderRadius: '50%',
          background: `radial-gradient(circle, ${C.purple}15 0%, transparent 70%)`,
          transform: isLeft ? 'translate(-30px, -30px)' : 'translate(30px, -30px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Status dot + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', justifyContent: isLeft ? 'flex-start' : 'flex-end' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: online ? C.green : C.textMuted,
          animation: online ? 'pulse 2s infinite' : 'none',
          order: isLeft ? 0 : 1,
        }} />
        <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: online ? C.green : C.textMuted }}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div style={{ fontSize: '13px', fontWeight: '700', color: C.text, marginBottom: '4px' }}>
        {node.id}
      </div>
      {node.public_key && (
        <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.textMuted, marginBottom: '12px' }}>
          {node.public_key}...
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { label: 'PEERS',      value: node.peers || 0,          color: online ? C.blue : C.textMuted },
          { label: 'BROADCASTS', value: node.broadcasts || 0,     color: online ? C.purple : C.textMuted },
          { label: 'TOKENS',     value: node.unique_tokens || 0,  color: online ? C.yellow : C.textMuted },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.1em', order: isLeft ? 0 : 1 }}>{s.label}</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A single animated packet dot traveling across the AXL connection line
function Packet({ fromLeft, type }) {
  const color = type === 'consensus' ? C.green : C.purple;
  return (
    <div style={{
      position: 'absolute', top: '50%',
      width: '10px', height: '10px', borderRadius: '50%',
      background: color,
      boxShadow: `0 0 8px ${color}`,
      transform: 'translateY(-50%)',
      animation: fromLeft
        ? 'packetRight 1.6s cubic-bezier(0.4,0,0.6,1) forwards'
        : 'packetLeft 1.6s cubic-bezier(0.4,0,0.6,1) forwards',
      pointerEvents: 'none',
    }} />
  );
}

function ConnectionLine({ packets, bothOnline }) {
  return (
    <div style={{
      flex: 1, position: 'relative', display: 'flex',
      alignItems: 'center', margin: '0 4px',
    }}>
      {/* Track */}
      <div style={{
        width: '100%', height: '2px',
        background: bothOnline
          ? `linear-gradient(90deg, ${C.purple}60, ${C.blue}60)`
          : C.border,
        borderRadius: '1px', position: 'relative',
        transition: 'background 0.5s',
      }}>
        {/* Animated glow when both online */}
        {bothOnline && (
          <div style={{
            position: 'absolute', inset: '-2px',
            background: `linear-gradient(90deg, transparent, ${C.purple}30, transparent)`,
            animation: 'scanLine 2s linear infinite',
            borderRadius: '2px',
          }} />
        )}
      </div>

      {/* Packets */}
      {packets.map(p => (
        <Packet key={p.id} fromLeft={p.fromLeft} type={p.type} />
      ))}

      {/* Center badge */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        background: C.bg, border: `1px solid ${bothOnline ? C.purple + '60' : C.border}`,
        borderRadius: '6px', padding: '5px 10px',
        fontSize: '9px', fontWeight: '700', letterSpacing: '0.12em',
        color: bothOnline ? C.purple : C.textMuted,
        whiteSpace: 'nowrap',
      }}>
        AXL MESH
      </div>
    </div>
  );
}

function MessageRow({ msg, isNew }) {
  const isConsensus = msg.type === 'consensus';
  const nodeColor = msg.node_id === 'vigil-node-1' ? C.blue : msg.node_id === 'vigil-node-2' ? C.purple : C.green;
  const icon = isConsensus ? '✓' : msg.direction === 'inbound' ? '▲' : '▼';
  const iconColor = isConsensus ? C.green : msg.direction === 'inbound' ? C.green : C.orange;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '54px 120px 90px 1fr 60px',
      gap: '8px', padding: '8px 20px',
      borderBottom: `1px solid ${C.border}`,
      background: isNew
        ? isConsensus ? 'rgba(34,197,94,0.06)' : 'rgba(124,58,237,0.04)'
        : 'transparent',
      animation: isNew ? 'slideIn 0.3s ease' : 'none',
      transition: 'background 0.2s',
      alignItems: 'center',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#0f0f20'}
      onMouseLeave={e => e.currentTarget.style.background = isNew ? (isConsensus ? 'rgba(34,197,94,0.06)' : 'rgba(124,58,237,0.04)') : 'transparent'}
    >
      {/* Type icon */}
      <div style={{
        fontSize: '11px', fontWeight: '700', color: iconColor,
        display: 'flex', alignItems: 'center', gap: '3px',
      }}>
        <span>{icon}</span>
        <span style={{ fontSize: '9px' }}>{isConsensus ? 'SIGNAL' : msg.direction?.toUpperCase().slice(0,3)}</span>
      </div>

      {/* Node */}
      <div style={{
        fontSize: '10px', fontWeight: '600',
        color: isConsensus ? C.green : nodeColor,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {isConsensus ? (
          <span style={{
            fontSize: '9px', background: '#052e16', border: `1px solid #166534`,
            color: C.green, padding: '1px 5px', borderRadius: '3px', fontWeight: '700',
          }}>CONSENSUS</span>
        ) : (
          <>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: nodeColor, display: 'inline-block', flexShrink: 0 }} />
            {msg.node_id?.replace('vigil-', '')}
          </>
        )}
      </div>

      {/* Event type */}
      <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.08em' }}>
        {isConsensus ? `${(msg.node_ids || []).map(n => n.replace('vigil-', '')).join(' + ')}` : 'OBSERVED'}
      </div>

      {/* Token */}
      <div style={{ fontSize: '12px', fontWeight: '600', color: isConsensus ? C.green : '#a78bfa' }}>
        {msg.token ? `$${msg.token}` : '—'}
        {isConsensus && msg.confidence > 0 && (
          <span style={{ fontSize: '10px', color: C.textDim, marginLeft: '6px', fontWeight: '400' }}>
            conf {msg.confidence}/200
          </span>
        )}
        {!isConsensus && msg.score > 0 && (
          <span style={{ fontSize: '10px', color: C.textMuted, marginLeft: '6px', fontWeight: '400' }}>
            score {msg.score}
          </span>
        )}
      </div>

      {/* Time */}
      <div style={{ fontSize: '10px', color: C.textMuted, textAlign: 'right' }}>
        {timeAgo(msg.timestamp)}
      </div>
    </div>
  );
}

export default function AXLNetwork() {
  const [data, setData] = useState({ nodes: [], messages: [], cross_node_events: 0, total_broadcasts: 0, consensus_count: 0 });
  const [packets, setPackets] = useState([]);
  const prevMsgLen = useRef(0);
  const packetId = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/network');
        if (r.ok) setData(await r.json());
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  // Spawn packet animations for new messages
  useEffect(() => {
    if (!data.messages.length) return;
    const newCount = data.messages.length - prevMsgLen.current;
    if (newCount > 0 && prevMsgLen.current > 0) {
      const newMsgs = data.messages.slice(0, Math.min(newCount, 3));
      newMsgs.forEach((msg, i) => {
        setTimeout(() => {
          const id = ++packetId.current;
          const fromLeft = msg.node_id === 'vigil-node-1' || msg.type === 'consensus';
          const type = msg.type;
          setPackets(p => [...p, { id, fromLeft, type }]);
          setTimeout(() => setPackets(p => p.filter(x => x.id !== id)), 1800);
        }, i * 200);
      });
    }
    prevMsgLen.current = data.messages.length;
  }, [data.messages.length]);

  const node1 = data.nodes.find(n => n.id === 'vigil-node-1') || { id: 'vigil-node-1', online: false, peers: 0, broadcasts: 0, unique_tokens: 0 };
  const node2 = data.nodes.find(n => n.id === 'vigil-node-2') || { id: 'vigil-node-2', online: false, peers: 0, broadcasts: 0, unique_tokens: 0 };
  const bothOnline = node1.online && node2.online;
  const eitherOnline = node1.online || node2.online;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes packetRight { 0%{left:0%} 100%{left:calc(100% - 10px)} }
        @keyframes packetLeft  { 0%{left:calc(100% - 10px)} 100%{left:0%} }
        @keyframes scanLine    { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: C.bg, flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: C.text }}>Gensyn AXL Network</span>
            <span style={{
              fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
              color: bothOnline ? C.green : eitherOnline ? C.yellow : C.textMuted,
              background: bothOnline ? '#052e16' : eitherOnline ? '#1c1408' : C.surface,
              border: `1px solid ${bothOnline ? '#166534' : eitherOnline ? '#78350f' : C.border}`,
              padding: '2px 7px', borderRadius: '3px',
            }}>
              {bothOnline ? '● MESH ACTIVE' : eitherOnline ? '◐ PARTIAL' : '○ OFFLINE'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: C.textDim, marginTop: '3px' }}>
            Encrypted P2P mesh — observations broadcast between independent nodes in real time
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { label: 'BROADCASTS', value: data.total_broadcasts,    color: C.purple },
            { label: 'CROSS-NODE', value: data.cross_node_events,   color: C.blue },
            { label: 'CONSENSUS',  value: data.consensus_count,     color: C.green },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.1em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Network diagram ── */}
      <div style={{
        padding: '28px 32px',
        background: '#050510',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {/* How it flows label */}
        <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.14em', marginBottom: '16px', textAlign: 'center' }}>
          LIVE P2P MESSAGE FLOW — POWERED BY GENSYN AXL
        </div>

        {/* Nodes + connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <NodeCard node={node1} side="left" />
          <ConnectionLine packets={packets} bothOnline={bothOnline} />
          <NodeCard node={node2} side="right" />
        </div>

        {/* Flow legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
          {[
            { color: C.purple, label: 'Observation broadcast' },
            { color: C.green,  label: 'Consensus signal' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              <span style={{ fontSize: '10px', color: C.textDim }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* What happens explainer */}
        <div style={{
          marginTop: '18px', padding: '12px 16px',
          background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
        }}>
          {[
            { step: '1', icon: '👁', title: 'Node observes',   body: 'Watcher detects a smart wallet accumulating a token on-chain via ERC-20 Transfer events' },
            { step: '2', icon: '📡', title: 'AXL broadcast',   body: 'Observation is encrypted and broadcast to all peers over the Gensyn AXL P2P mesh instantly' },
            { step: '3', icon: '✓',  title: 'Consensus fires', body: '2+ independent wallets on any nodes accumulating the same token within 20 min = verified signal' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                background: C.purple + '20', border: `1px solid ${C.purple}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px',
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: C.text, marginBottom: '3px' }}>{s.title}</div>
                <div style={{ fontSize: '10px', color: C.textDim, lineHeight: '1.5' }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Message stream ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '54px 120px 90px 1fr 60px',
          gap: '8px', padding: '7px 20px',
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, zIndex: 5,
        }}>
          {['TYPE', 'NODE', 'EVENT', 'TOKEN / DETAIL', 'WHEN'].map(h => (
            <div key={h} style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.12em' }}>{h}</div>
          ))}
        </div>

        {data.messages.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', opacity: 0.1, marginBottom: '16px' }}>⟷</div>
            <div style={{ fontSize: '13px', color: C.textDim }}>
              {eitherOnline ? 'Waiting for observations...' : 'Start both AXL nodes to activate the mesh'}
            </div>
          </div>
        ) : (
          data.messages.map((msg, i) => (
            <MessageRow key={`${msg.timestamp}-${msg.node_id}-${i}`} msg={msg} isNew={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}
