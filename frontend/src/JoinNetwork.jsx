import React, { useState } from 'react';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

const DASHBOARD_URL = process.env.REACT_APP_API_URL
  ? window.location.origin
  : 'http://localhost:3000';

function CopyBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{ position: 'relative', margin: '10px 0' }}>
      {label && <div style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.12em', marginBottom: '5px' }}>{label}</div>}
      <div style={{
        background: '#030308', border: `1px solid ${C.border}`,
        borderRadius: '6px', padding: '12px 48px 12px 16px',
        fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa',
        lineHeight: '1.7', whiteSpace: 'pre', overflowX: 'auto',
      }}>
        {code}
      </div>
      <button onClick={copy} style={{
        position: 'absolute', top: label ? '28px' : '8px', right: '10px',
        background: copied ? C.green + '20' : C.border,
        border: `1px solid ${copied ? C.green : C.border}`,
        color: copied ? C.green : C.textDim,
        fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
        transition: 'all 0.15s', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        {copied ? '✓ copied' : 'copy'}
      </button>
    </div>
  );
}

function StepBadge({ n, done }) {
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      background: done ? C.green + '20' : C.purple + '20',
      border: `2px solid ${done ? C.green : C.purple}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: '700', color: done ? C.green : C.purple,
    }}>
      {done ? '✓' : n}
    </div>
  );
}

function Step({ n, title, subtitle, children, done = false }) {
  const [open, setOpen] = useState(n === 1);
  return (
    <div style={{
      border: `1px solid ${done ? C.green + '30' : open ? C.purple + '40' : C.border}`,
      borderRadius: '10px', overflow: 'hidden', marginBottom: '12px',
      background: done ? '#030e06' : open ? '#0a0a18' : C.surface,
      transition: 'all 0.2s',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: 'none', color: C.text, textAlign: 'left',
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
        cursor: 'pointer',
      }}>
        <StepBadge n={n} done={done} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: done ? C.green : C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{subtitle}</div>}
        </div>
        <span style={{ color: C.textMuted, fontSize: '12px', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em',
      background: color + '18', border: `1px solid ${color}40`,
      color, padding: '2px 8px', borderRadius: '4px',
    }}>{children}</span>
  );
}

function InfoRow({ icon, label, value, color = C.textDim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.purple, width: '16px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '11px', color: C.textMuted, flex: 1 }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: '600', color }}>{value}</span>
    </div>
  );
}

export default function JoinNetwork({ nodeCount = 1, signalCount = 0, walletCount = 100 }) {
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px 60px' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0520 0%, #070710 100%)',
        border: `1px solid ${C.purple}30`,
        borderRadius: '14px', padding: '32px 36px', marginBottom: '32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '220px', height: '220px', borderRadius: '50%',
          background: `radial-gradient(circle, ${C.purple}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}30, ${C.blue}20)`,
            border: `1px solid ${C.purple}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px',
          }}>◈</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>Run a Vigil Node</span>
              <Pill color={C.green}>OPEN SOURCE</Pill>
              <Pill color={C.blue}>PERMISSIONLESS</Pill>
            </div>
            <p style={{ fontSize: '14px', color: C.textDim, lineHeight: '1.7', maxWidth: '560px' }}>
              Vigil is a decentralized on-chain intelligence network. Each node watches a slice of smart wallets on Ethereum and shares observations over <strong style={{ color: C.purple }}>Gensyn AXL</strong> — an encrypted P2P mesh. You don't need to run a dashboard — just connect and your node strengthens every signal the network produces.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '24px' }}>
          {[
            { label: 'Active nodes',    value: nodeCount,    color: C.green },
            { label: 'Wallets tracked', value: walletCount,  color: C.blue },
            { label: 'Signals fired',   value: signalCount,  color: C.purple },
            { label: 'Setup time',      value: '~10 min',    color: C.yellow },
            { label: 'Cost',            value: 'Free',       color: C.green },
          ].map(s => (
            <div key={s.label} style={{ background: C.bg, borderRadius: '8px', padding: '12px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '3px', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Identity callout */}
      <div style={{
        padding: '16px 20px', marginBottom: '24px',
        background: '#070d14', border: `1px solid ${C.blue}30`,
        borderRadius: '10px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: C.blue, marginBottom: '8px' }}>◈ Your node identity</div>
        <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.7' }}>
          Every node has two identifiers:<br />
          <span style={{ color: C.text }}>NODE_ID</span> — your human-readable name (e.g. <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 4px', borderRadius: '3px' }}>vigil-node-3</code>). This appears in the <strong>AXL Network</strong> tab when your node broadcasts an observation.<br />
          <span style={{ color: C.text }}>AXL Public Key</span> — your cryptographic identity on the Gensyn mesh. Printed in the AXL startup log as <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 4px', borderRadius: '3px' }}>Our Public Key: xxxx...</code>. Unique per node, generated locally, never shared.
        </div>
        <div style={{ marginTop: '10px', padding: '8px 12px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim }}>
          Once your node broadcasts an observation, your NODE_ID and broadcast count appear in the <strong style={{ color: C.blue }}>AXL Network → Node Contributions</strong> section of the live dashboard.
        </div>
      </div>

      {/* Prerequisites */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>PREREQUISITES</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '4px 16px' }}>
          <InfoRow icon="⬡" label="Python" value="3.10 or higher" color={C.green} />
          <InfoRow icon="⬡" label="Go" value="1.21+ (to build AXL from source)" color={C.green} />
          <InfoRow icon="⬡" label="Ethereum RPC" value="Any free public endpoint works" color={C.blue} />
          <InfoRow icon="⬡" label="Git" value="To clone the repositories" color={C.textDim} />
        </div>
        <div style={{ marginTop: '10px', padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <span style={{ color: C.yellow }}>◈ No paid RPC required.</span> Free endpoints like <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>wss://ethereum.publicnode.com</code> work out of the box.
        </div>
      </div>

      {/* Steps */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>SETUP GUIDE</div>

      <Step n={1} title="Clone the repository" subtitle="Get the Vigil source code">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Clone Vigil and install Python dependencies:
        </div>
        <CopyBlock code={`git clone https://github.com/flamiinngo/vigil
cd vigil
pip install -r requirements.txt`} />
      </Step>

      <Step n={2} title="Configure your environment" subtitle="Create a .env file in the project root">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Create <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>.env</code> in the project root — pick a unique NODE_ID:
        </div>
        <CopyBlock label=".env" code={`ETH_WS_URL=wss://ethereum.publicnode.com
ETH_RPC_URL=https://ethereum-rpc.publicnode.com
NODE_ID=vigil-node-3
AXL_URL=http://localhost:9002
VIGIL_NETWORK_URL=https://viigil.up.railway.app`} />
        <div style={{ padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <div style={{ marginBottom: '6px' }}><span style={{ color: C.yellow }}>NODE_ID</span> — choose any name. Use <code style={{ color: '#a78bfa' }}>vigil-node-3</code> or higher — lower numbers are already running on the network.</div>
          <div><span style={{ color: C.yellow }}>VIGIL_NETWORK_URL</span> — the live network hub. Your node fetches the hub's AXL public key and routes observations to it directly over the Gensyn mesh.</div>
        </div>
      </Step>

      <Step n={3} title="Build and start your AXL node" subtitle="Connects you to the Gensyn P2P mesh">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Build AXL from source:
        </div>
        <CopyBlock code={`git clone https://github.com/gensyn-ai/axl.git
cd axl
make build
openssl genpkey -algorithm ed25519 -out private.pem`} />
        <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px', marginTop: '10px' }}>
          Create <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>node-config.json</code> inside the axl folder:
        </div>
        <CopyBlock label="node-config.json" code={`{
  "PrivateKeyPath": "private.pem",
  "Peers": [
    "tls://34.46.48.224:9001",
    "tls://136.111.135.206:9001"
  ],
  "Listen": ["tls://0.0.0.0:9001"],
  "api_port": 9002
}`} />
        <div style={{ padding: '10px 14px', background: '#030e06', borderRadius: '6px', border: `1px solid ${C.green}20`, fontSize: '11px', color: C.textDim, lineHeight: '1.6', marginBottom: '10px' }}>
          <span style={{ color: C.green }}>◈ These are Gensyn's live bootstrap nodes.</span> They route your observations through the mesh to every other connected Vigil node.
        </div>
        <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>Start AXL (Terminal 1):</div>
        <CopyBlock code={`./node -config node-config.json`} />
        <div style={{ marginTop: '8px', padding: '8px 14px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim }}>
          Look for <code style={{ color: C.green }}>Connected outbound: ...@34.46.48.224:9001</code> — that confirms you're on the Gensyn mesh. Your AXL Public Key is printed as <code style={{ color: '#a78bfa' }}>Our Public Key: xxxx...</code> — save it as your node's cryptographic identity.
        </div>
      </Step>

      <Step n={4} title="Discover your wallet set" subtitle="~2 min scan — builds your unique wallet watchlist from on-chain Uniswap activity">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          From the <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>agent/</code> directory (Terminal 2):
        </div>
        <CopyBlock code={`cd agent
python discover.py --top 100`} />
        <div style={{ padding: '10px 14px', background: '#030e06', borderRadius: '6px', border: `1px solid ${C.green}20`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          Scans Uniswap v3 Swap events from the last ~3,000 blocks, scores wallets by pool diversity, saves top 100 to <code style={{ color: '#a78bfa' }}>wallets.json</code>. This list is yours — independent from every other node on the network.
        </div>
      </Step>

      <Step n={5} title="Start watching" subtitle="Your node joins the live network">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          From <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>agent/</code> (Terminal 2):
        </div>
        <CopyBlock code={`python main.py`} />
        <div style={{ padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6', marginTop: '10px' }}>
          <div style={{ marginBottom: '5px' }}>Look for: <code style={{ color: C.green }}>Discovered remote Vigil node: xxxx... via https://viigil.up.railway.app</code></div>
          <div>This confirms your node found the network hub and will route observations to it. You don't need to run a local server or dashboard — just open the live dashboard to see your node appear.</div>
        </div>
        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#030e06', borderRadius: '6px', border: `1px solid ${C.green}20`, fontSize: '11px', color: C.textDim }}>
          <span style={{ color: C.green }}>◈ Watch the network at:</span>{' '}
          <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>
            {DASHBOARD_URL}
          </a>
          {' '}→ AXL Network tab → Node Contributions. Your NODE_ID and broadcast count appear as soon as your first observation is sent.
        </div>
      </Step>

      {/* How it works */}
      <div style={{ marginTop: '32px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em' }}>HOW THE NETWORK WORKS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '32px' }}>
        {[
          { icon: '◈', color: C.purple, title: 'Independent watching', body: 'Each node discovers its own wallet set independently. No two nodes track identical wallets — this creates genuine redundancy and harder-to-game signals.' },
          { icon: '⟷', color: C.blue,   title: 'AXL P2P broadcast',   body: 'Every wallet movement is encrypted and broadcast over the Gensyn AXL mesh. No central server. No shared database. Nodes coordinate without trusting each other.' },
          { icon: '✓', color: C.green,  title: 'Convergence signals',  body: 'A signal fires only when 2+ distinct wallets accumulate the same token within 20 minutes — across any combination of nodes. More nodes = stronger consensus.' },
        ].map(card => (
          <div key={card.title} style={{ background: C.surface, border: `1px solid ${card.color}20`, borderRadius: '10px', padding: '18px 16px' }}>
            <div style={{ fontSize: '20px', color: card.color, marginBottom: '10px' }}>{card.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: C.text, marginBottom: '7px' }}>{card.title}</div>
            <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>{card.body}</div>
          </div>
        ))}
      </div>

      {/* Quick reference */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>QUICK REFERENCE — 2 TERMINALS</div>
      <div style={{ background: '#030308', border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        {[
          { n: 'T1', label: 'AXL node (P2P mesh)',  cmd: 'cd axl && ./node -config node-config.json', color: C.blue },
          { n: 'T2', label: 'Vigil node (watcher)', cmd: 'cd agent && python main.py',               color: C.purple },
        ].map((row, i, arr) => (
          <div key={row.n} style={{
            display: 'grid', gridTemplateColumns: '36px 180px 1fr',
            alignItems: 'center', gap: '12px', padding: '12px 16px',
            borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: row.color, background: row.color + '18', border: `1px solid ${row.color}30`, padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>{row.n}</span>
            <span style={{ fontSize: '11px', color: C.textDim }}>{row.label}</span>
            <code style={{ fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa' }}>{row.cmd}</code>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '28px', padding: '16px 20px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.7' }}>
        <span style={{ color: C.purple, fontWeight: '600' }}>◈ Your contribution is visible</span><br />
        Every observation your node broadcasts increments your broadcast count on the live dashboard. When your wallets and another node's wallets independently accumulate the same token, the signal confidence increases — and your NODE_ID is credited in the signal's node list. The network gets more accurate with every independent operator.
      </div>
    </div>
  );
}
