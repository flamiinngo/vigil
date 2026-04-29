import React, { useState } from 'react';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

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
              Vigil is a decentralized on-chain intelligence network. Each node watches a slice of smart wallets on Ethereum and shares observations over <strong style={{ color: C.purple }}>Gensyn AXL</strong> — an encrypted P2P mesh. The more nodes, the stronger the signal.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '24px' }}>
          {[
            { label: 'Active nodes',   value: nodeCount,    color: C.green },
            { label: 'Wallets tracked', value: walletCount, color: C.blue },
            { label: 'Signals fired',  value: signalCount,  color: C.purple },
            { label: 'Setup time',     value: '~10 min',    color: C.yellow },
            { label: 'Cost',           value: 'Free',       color: C.green },
          ].map(s => (
            <div key={s.label} style={{ background: C.bg, borderRadius: '8px', padding: '12px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '3px', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>PREREQUISITES</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '4px 16px' }}>
          <InfoRow icon="⬡" label="Python" value="3.10 or higher" color={C.green} />
          <InfoRow icon="⬡" label="Node.js" value="18 or higher" color={C.green} />
          <InfoRow icon="⬡" label="Ethereum RPC" value="Any public endpoint works" color={C.blue} />
          <InfoRow icon="⬡" label="Gensyn AXL binary" value="Download from Gensyn" color={C.yellow} />
          <InfoRow icon="⬡" label="Git" value="To clone the repository" color={C.textDim} />
        </div>
        <div style={{ marginTop: '10px', padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <span style={{ color: C.yellow }}>◈ No paid RPC required.</span> Public endpoints like <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>https://ethereum-rpc.publicnode.com</code> work out of the box.
        </div>
      </div>

      {/* Steps */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>SETUP GUIDE</div>

      <Step n={1} title="Clone the repository" subtitle="Get the source code onto your machine">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Clone Vigil and install Python dependencies:
        </div>
        <CopyBlock code={`git clone https://github.com/YOUR_USERNAME/vigil
cd vigil
pip install -r requirements.txt`} />
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '8px', lineHeight: '1.6' }}>
          Then install the frontend dependencies:
        </div>
        <CopyBlock code={`cd frontend
npm install
cd ..`} />
      </Step>

      <Step n={2} title="Configure your environment" subtitle="Create a .env file in the project root">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Create a file named <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>.env</code> in the project root:
        </div>
        <CopyBlock label=".env" code={`ETH_RPC=https://ethereum-rpc.publicnode.com
NODE_ID=vigil-node-3
AXL_URL=http://localhost:9002
API_PORT=5050`} />
        <div style={{ padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <div style={{ marginBottom: '5px' }}><span style={{ color: C.yellow }}>NODE_ID</span> — pick a unique name. The network already has <code style={{ color: '#a78bfa' }}>vigil-node-1</code> and <code style={{ color: '#a78bfa' }}>vigil-node-2</code>, so start from <code style={{ color: '#a78bfa' }}>vigil-node-3</code>.</div>
          <div><span style={{ color: C.yellow }}>AXL_URL</span> — the local AXL REST port you'll configure in Step 3.</div>
        </div>
      </Step>

      <Step n={3} title="Start your AXL node" subtitle="Connect to the Gensyn P2P mesh — this broadcasts your observations to other nodes">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          Create <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>axl-config.yaml</code> in the project root:
        </div>
        <CopyBlock label="axl-config.yaml" code={`listen_addr: "0.0.0.0:9005"
rest_addr: "0.0.0.0:9006"
bootstrap_peers:
  - "BOOTSTRAP_PUBKEY@BOOTSTRAP_IP:9001"`} />
        <div style={{ padding: '10px 14px', background: '#0c0a04', borderRadius: '6px', border: `1px solid ${C.yellow}20`, fontSize: '11px', color: C.textDim, lineHeight: '1.6', marginBottom: '10px' }}>
          <span style={{ color: C.yellow }}>◈ Bootstrap peer</span> — get the bootstrap public key + IP from the network operator (the person running <code style={{ color: '#a78bfa' }}>vigil-node-1</code>). This links your node into the existing mesh.
        </div>
        <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>Start AXL (Terminal 1):</div>
        <CopyBlock code={`./axl -config axl-config.yaml`} />
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '8px', lineHeight: '1.6' }}>
          AXL will print its public key on startup — share that with the network operator so they can add you as a bootstrap peer too.
        </div>
        <div style={{ marginTop: '8px', padding: '8px 14px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim }}>
          Also update <code style={{ color: '#a78bfa' }}>.env</code> with your AXL REST port: <code style={{ color: C.green }}>AXL_URL=http://localhost:9006</code>
        </div>
      </Step>

      <Step n={4} title="Discover smart wallets" subtitle="One-time scan — builds your local wallet watchlist from on-chain Uniswap activity">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          From the <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>agent/</code> directory (Terminal 2):
        </div>
        <CopyBlock code={`cd agent
python discover.py`} />
        <div style={{ padding: '10px 14px', background: '#030e06', borderRadius: '6px', border: `1px solid ${C.green}20`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <div style={{ marginBottom: '5px' }}><span style={{ color: C.green }}>What this does:</span> Scans the last ~3,000 blocks of Uniswap v3 Swap events, collects real EOA addresses (from <code style={{ color: '#a78bfa' }}>tx.from</code>), scores each wallet by trading frequency and pool diversity, and saves the top 100 to <code style={{ color: '#a78bfa' }}>wallets.json</code>.</div>
          <div><span style={{ color: C.green }}>Takes ~2 minutes.</span> Only needs to run once. You can re-run it later to refresh your wallet list.</div>
        </div>
      </Step>

      <Step n={5} title="Start the Vigil node" subtitle="Watches your 100 wallets and shares intelligence over AXL">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          From <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>agent/</code> (Terminal 2 — same one as Step 4):
        </div>
        <CopyBlock code={`python main.py`} />
        <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.6', marginTop: '10px', marginBottom: '4px' }}>
          Start the API server in a separate terminal (Terminal 3):
        </div>
        <CopyBlock code={`python server.py`} />
        <div style={{ padding: '10px 14px', background: '#0a0a14', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>
          <code style={{ color: '#a78bfa' }}>main.py</code> subscribes to your wallet slice on Ethereum mainnet and broadcasts every inbound token movement to the AXL mesh. <code style={{ color: '#a78bfa' }}>server.py</code> exposes the data to the frontend on port 5050.
        </div>
      </Step>

      <Step n={6} title="Open the dashboard" subtitle="Your node is live — watch intelligence flow in real time">
        <div style={{ marginTop: '14px', fontSize: '12px', color: C.textDim, lineHeight: '1.6', marginBottom: '4px' }}>
          From the <code style={{ color: '#a78bfa', background: C.bg, padding: '1px 5px', borderRadius: '3px' }}>frontend/</code> directory (Terminal 4):
        </div>
        <CopyBlock code={`npm start`} />
        <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.6', marginTop: '10px' }}>
          Open <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>http://localhost:3000</a>. You should see:
        </div>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { icon: '◉', color: C.green, text: 'Your NODE ID shows CONNECTED in the Node Status panel' },
            { icon: '◉', color: C.green, text: 'Live Activity populates within seconds of any watched wallet transacting' },
            { icon: '◉', color: C.green, text: 'Accumulation tab shows tokens being bought by your wallets' },
            { icon: '◉', color: C.green, text: 'Signals fire when 2+ distinct wallets accumulate the same token within 20 min' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 12px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}` }}>
              <span style={{ color: item.color, fontSize: '10px', marginTop: '1px', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.5' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </Step>

      {/* How it works explainer */}
      <div style={{ marginTop: '32px', marginBottom: '12px', fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em' }}>HOW THE NETWORK WORKS</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px',
        marginBottom: '32px',
      }}>
        {[
          {
            icon: '◈', color: C.purple,
            title: 'Independent watching',
            body: 'Each node monitors its own wallet slice. No two nodes track identical sets — this creates true redundancy.',
          },
          {
            icon: '⟷', color: C.blue,
            title: 'AXL P2P broadcast',
            body: 'Every inbound movement is encrypted and broadcast to all peers over Gensyn\'s AXL mesh — no central server.',
          },
          {
            icon: '✓', color: C.green,
            title: 'Convergence signals',
            body: 'A signal fires only when 2+ distinct wallets accumulate the same token within a 20-minute window.',
          },
        ].map(card => (
          <div key={card.title} style={{
            background: C.surface, border: `1px solid ${card.color}20`,
            borderRadius: '10px', padding: '18px 16px',
          }}>
            <div style={{ fontSize: '20px', color: card.color, marginBottom: '10px' }}>{card.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: C.text, marginBottom: '7px' }}>{card.title}</div>
            <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.6' }}>{card.body}</div>
          </div>
        ))}
      </div>

      {/* Terminal quick-reference */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textDim, letterSpacing: '0.14em', marginBottom: '14px' }}>QUICK REFERENCE — ALL 4 TERMINALS</div>
      <div style={{
        background: '#030308', border: `1px solid ${C.border}`,
        borderRadius: '10px', overflow: 'hidden',
      }}>
        {[
          { n: 'T1', label: 'AXL node (P2P mesh)',     cmd: './axl -config axl-config.yaml',          color: C.blue },
          { n: 'T2', label: 'Vigil node (watcher)',     cmd: 'cd agent && python main.py',             color: C.purple },
          { n: 'T3', label: 'API server (frontend)',    cmd: 'cd agent && python server.py',           color: C.yellow },
          { n: 'T4', label: 'Dashboard (React)',        cmd: 'cd frontend && npm start',               color: C.green },
        ].map((row, i, arr) => (
          <div key={row.n} style={{
            display: 'grid', gridTemplateColumns: '36px 180px 1fr',
            alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', color: row.color,
              background: row.color + '18', border: `1px solid ${row.color}30`,
              padding: '2px 6px', borderRadius: '4px', textAlign: 'center',
            }}>{row.n}</span>
            <span style={{ fontSize: '11px', color: C.textDim }}>{row.label}</span>
            <code style={{ fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa' }}>{row.cmd}</code>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '28px', padding: '16px 20px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '11px', color: C.textDim, lineHeight: '1.7' }}>
        <span style={{ color: C.purple, fontWeight: '600' }}>◈ Contributing to the network</span><br />
        Your node strengthens every signal. When your wallet slice sees the same token as another node's wallets, the confidence score increases. The more independent nodes confirm a movement, the more trustworthy the signal — and the more valuable the intelligence becomes for everyone.
      </div>
    </div>
  );
}
