import React, { useState, useEffect, useCallback, useRef } from 'react';
import SignalFeed from './SignalFeed';
import HotTokens from './HotTokens';
import LiveFeed from './LiveFeed';
import NodeStatus from './NodeStatus';
import WalletLeaderboard from './WalletLeaderboard';
import MarketBar from './MarketBar';
import Logo from './Logo';
import JoinNetwork from './JoinNetwork';
import AXLNetwork from './AXLNetwork';
import API from './config';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

export default function App() {
  const [signals, setSignals]     = useState([]);
  const [hotTokens, setHotTokens] = useState([]);
  const [activities, setActivities] = useState([]);
  const [lastFetch, setLastFetch] = useState(null);
  const [activeTab, setActiveTab] = useState('hot');
  const [wallet, setWallet]       = useState(null);
  const [axlStatus, setAxlStatus] = useState({ online: false, peers: 0 });
  const [notifEnabled, setNotifEnabled] = useState(false);
  const prevSigCount = useRef(0);

  // Filters
  const [minConfidence, setMinConfidence] = useState(0);
  const [minLiquidity, setMinLiquidity]   = useState(0);
  const [timeRange, setTimeRange]         = useState(0);
  const [sortBy, setSortBy]               = useState('latest');
  const [search, setSearch]               = useState('');

  // Wallet connection
  async function connectWallet() {
    if (!window.ethereum) { alert('MetaMask not found — install it from metamask.io'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) setWallet(accounts[0].toLowerCase());
    } catch (_) {}
  }

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' })
      .then(acc => { if (acc[0]) setWallet(acc[0].toLowerCase()); });
    const h = acc => setWallet(acc[0]?.toLowerCase() || null);
    window.ethereum.on('accountsChanged', h);
    return () => window.ethereum.removeListener('accountsChanged', h);
  }, []);

  // Notification permission + signal alerts
  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  }

  useEffect(() => {
    if (Notification.permission === 'granted') setNotifEnabled(true);
  }, []);

  useEffect(() => {
    if (!notifEnabled || !signals.length) return;
    if (prevSigCount.current === 0) { prevSigCount.current = signals.length; return; }
    if (signals.length > prevSigCount.current) {
      const newest = signals[0];
      const sym = newest.uniswap?.symbol ? `$${newest.uniswap.symbol}` : newest.token_address?.slice(0, 8);
      const chg = newest.uniswap?.price_change_24h_pct;
      const body = `Smart money accumulating ${sym}${chg != null ? `  ${chg >= 0 ? '▲' : '▼'}${Math.abs(chg).toFixed(1)}%` : ''}  ·  Vigil`;
      new Notification('🔔 New Signal', { body, icon: '/favicon.ico' });
    }
    prevSigCount.current = signals.length;
  }, [signals.length, notifEnabled]);

  // Data polling
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/axl-status`);
        if (r.ok) setAxlStatus(await r.json());
      } catch (_) {}
    };
    load(); const id = setInterval(load, 30000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/signals.json`);
        if (!r.ok) return;
        setSignals(await r.json());
        setLastFetch(new Date());
      } catch (_) {}
    };
    load(); const id = setInterval(load, 5000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/hot`);
        if (!r.ok) return;
        const d = await r.json();
        setHotTokens(Array.isArray(d) ? d : []);
      } catch (_) {}
    };
    load(); const id = setInterval(load, 3000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/activity`);
        if (!r.ok) return;
        const d = await r.json();
        setActivities(Array.isArray(d) ? d : []);
      } catch (_) {}
    };
    load(); const id = setInterval(load, 2000); return () => clearInterval(id);
  }, []);

  const fSignals = useCallback(() => {
    let out = [...signals];
    const now = Date.now() / 1000;
    if (timeRange > 0)     out = out.filter(s => s.timestamp > now - timeRange * 3600);
    if (minConfidence > 0) out = out.filter(s => (s.confidence || 0) >= minConfidence);
    if (minLiquidity > 0)  out = out.filter(s => (s.uniswap?.liquidity_usd || 0) >= minLiquidity);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(s =>
        (s.token_address || '').includes(q) ||
        (s.uniswap?.symbol || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'confidence') out.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    else if (sortBy === 'liquidity') out.sort((a, b) => (b.uniswap?.liquidity_usd || 0) - (a.uniswap?.liquidity_usd || 0));
    return out;
  }, [signals, timeRange, minConfidence, minLiquidity, search, sortBy]);

  const todaySignals = signals.filter(s => s.timestamp > Date.now() / 1000 - 86400).length;
  const fSig = fSignals();

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Inter', 'JetBrains Mono', monospace",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{filter:drop-shadow(0 0 4px #7c3aed60)} 50%{filter:drop-shadow(0 0 12px #7c3aeda0)} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        input, select { outline: none; }
        button { cursor: pointer; border: none; font-family: inherit; }
      `}</style>

      {/* ── Top market data bar ── */}
      <MarketBar />

      {/* ── Header ── */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: logo + tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ animation: 'glow 3s infinite', display: 'flex' }}>
              <Logo size={30} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '0.14em', color: '#fff' }}>VIGIL</div>
              <div style={{ fontSize: '8px', color: C.textDim, letterSpacing: '0.15em' }}>INTELLIGENCE TERMINAL</div>
            </div>
          </div>

          {[
            { id: 'hot',     label: 'Accumulation',  badge: hotTokens.length || null },
            { id: 'signals', label: 'Signals',        badge: signals.length || null },
            { id: 'live',    label: 'Live Activity',  badge: activities.length || null, live: true },
            { id: 'network', label: 'AXL Network',    badge: null, axl: true },
            { id: 'join',    label: 'Join Network',   badge: null },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: 'none', color: activeTab === tab.id ? C.text : C.textDim,
              fontSize: '12px', fontWeight: activeTab === tab.id ? '600' : '400',
              padding: '4px 0',
              borderBottom: activeTab === tab.id ? `2px solid ${C.purple}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
            }}>
              {tab.live && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.green, animation: 'pulse 1.5s infinite', display: 'inline-block' }} />}
              {tab.axl && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: axlStatus.online ? C.purple : C.textMuted, display: 'inline-block' }} />}
              {tab.label}
              {tab.badge > 0 && (
                <span style={{ background: activeTab === tab.id ? C.purple : C.border, color: activeTab === tab.id ? '#fff' : C.textDim, fontSize: '9px', borderRadius: '8px', padding: '1px 5px', fontWeight: '700' }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Right: stats + wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {[
            { label: 'SIGNALS', value: todaySignals, color: C.purple },
            { label: 'WATCHING', value: `100 wallets`, color: C.blue },
            { label: 'ACTIVITY', value: activities.length, color: C.green },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '8px', color: C.textMuted, letterSpacing: '0.1em' }}>{s.label}</div>
            </div>
          ))}

          {/* Notification bell */}
          <button onClick={notifEnabled ? null : enableNotifications} title={notifEnabled ? 'Notifications on' : 'Enable signal alerts'} style={{
            background: notifEnabled ? C.green + '18' : C.surface,
            border: `1px solid ${notifEnabled ? C.green + '40' : C.border}`,
            color: notifEnabled ? C.green : C.textDim,
            fontSize: '14px', padding: '4px 9px', borderRadius: '6px',
            cursor: notifEnabled ? 'default' : 'pointer',
          }}>
            {notifEnabled ? '🔔' : '🔕'}
          </button>

          <button onClick={connectWallet} style={{
            background: wallet ? '#1a1030' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: `1px solid ${wallet ? C.purple + '50' : 'transparent'}`,
            color: wallet ? '#a78bfa' : '#fff',
            fontSize: '11px', fontWeight: '600', padding: '5px 14px',
            borderRadius: '6px',
          }}>
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Connect Wallet'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.green, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '10px', color: C.green, fontWeight: '600' }}>LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Signal ticker (when signals exist) ── */}
      {signals.length > 0 && (
        <div style={{ background: '#050508', borderBottom: `1px solid ${C.border}`, height: '26px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '40px', whiteSpace: 'nowrap', animation: 'ticker 25s linear infinite', width: 'max-content', paddingTop: '4px', paddingLeft: '24px' }}>
            {[...signals, ...signals].slice(0, 30).map((s, i) => {
              const sym = s.uniswap?.symbol ? `$${s.uniswap.symbol}` : s.token_address?.slice(0, 8) + '...';
              const chg = s.uniswap?.price_change_24h_pct;
              return (
                <span key={i} style={{ fontSize: '10px', color: chg > 0 ? C.green : chg < 0 ? C.red : C.textDim }}>
                  <span style={{ color: C.purple, marginRight: '4px' }}>✓</span>
                  {sym}{chg != null ? ` ${chg >= 0 ? '▲' : '▼'}${Math.abs(chg).toFixed(1)}%` : ''}
                  <span style={{ color: C.textMuted, margin: '0 8px' }}>·</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter bar (signals tab only) ── */}
      {activeTab !== 'join' && activeTab === 'signals' && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: C.textDim, fontSize: '12px' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '5px', padding: '5px 9px 5px 26px', color: C.text, fontSize: '11px', width: '160px' }} />
          </div>
          <FilterSelect label="TIME" value={timeRange} onChange={setTimeRange} options={[{label:'All',value:0},{label:'1h',value:1},{label:'6h',value:6},{label:'24h',value:24}]} />
          <FilterSelect label="CONF" value={minConfidence} onChange={setMinConfidence} options={[{label:'Any',value:0},{label:'80+',value:80},{label:'120+',value:120},{label:'160+',value:160}]} />
          <FilterSelect label="LIQ" value={minLiquidity} onChange={setMinLiquidity} options={[{label:'Any',value:0},{label:'$10K+',value:10000},{label:'$100K+',value:100000},{label:'$1M+',value:1000000}]} />
          <FilterSelect label="SORT" value={sortBy} onChange={setSortBy} options={[{label:'Latest',value:'latest'},{label:'Confidence',value:'confidence'},{label:'Liquidity',value:'liquidity'}]} />
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.textMuted }}>{fSig.length} of {signals.length}</span>
          {lastFetch && <span style={{ fontSize: '10px', color: C.textMuted }}>{lastFetch.toLocaleTimeString()}</span>}
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Center — main intelligence */}
        <div style={{ flex: 1, borderRight: (activeTab === 'join' || activeTab === 'network') ? 'none' : `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'live'    && <LiveFeed activities={activities} hotTokens={hotTokens} />}
            {activeTab === 'hot'     && <HotTokens tokens={hotTokens} />}
            {activeTab === 'signals' && <SignalFeed signals={fSig} total={signals.length} wallet={wallet} />}
            {activeTab === 'network' && <AXLNetwork />}
            {activeTab === 'join'    && <JoinNetwork nodeCount={axlStatus.online ? axlStatus.peers + 1 : 1} signalCount={signals.length} walletCount={100} />}
          </div>
        </div>

        {/* Right sidebar — hidden on Network and Join tabs */}
        {activeTab !== 'join' && activeTab !== 'network' && <div style={{ width: '300px', background: C.surface, overflowY: 'auto', flexShrink: 0 }}>
          <NodeStatus />

          {/* How it works */}
          <div style={{ margin: '12px', padding: '14px', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.textDim, letterSpacing: '0.12em' }}>HOW IT WORKS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: axlStatus.online ? C.green : C.textMuted }} />
                <span style={{ fontSize: '10px', fontWeight: '600', color: axlStatus.online ? C.green : C.textMuted }}>
                  {axlStatus.online ? `${axlStatus.peers + 1} nodes` : '1 node'}
                </span>
              </div>
            </div>
            {[
              { icon: '◈', text: `100 smart wallets watched across ${axlStatus.online && axlStatus.peers > 0 ? axlStatus.peers + 1 : 2} independent AXL nodes` },
              { icon: '⟷', text: 'Nodes share observations over Gensyn\'s encrypted P2P mesh' },
              { icon: '✓', text: 'Signal fires when 2+ wallets accumulate the same token in 20 min' },
              { icon: '⚡', text: 'Every signal verifiable on Etherscan — fully transparent' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '9px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <span style={{ color: C.purple, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.5' }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Top movers */}
          {signals.length > 0 && (
            <div style={{ margin: '0 12px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.textDim, letterSpacing: '0.12em', marginBottom: '8px' }}>TOP SIGNAL MOVERS</div>
              {Object.values(
                signals.filter(s => s.uniswap?.price_change_24h_pct).reduce((acc, s) => {
                  const addr = s.token_address;
                  if (!acc[addr] || Math.abs(s.uniswap.price_change_24h_pct) > Math.abs(acc[addr].uniswap.price_change_24h_pct))
                    acc[addr] = s;
                  return acc;
                }, {})
              ).sort((a, b) => Math.abs(b.uniswap.price_change_24h_pct) - Math.abs(a.uniswap.price_change_24h_pct))
              .slice(0, 5).map((s, i) => {
                const sym = s.uniswap?.symbol ? `$${s.uniswap.symbol}` : s.token_address?.slice(0, 8) + '...';
                const chg = s.uniswap.price_change_24h_pct;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '12px', color: C.text }}>{sym}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: chg >= 0 ? C.green : C.red }}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}

          <WalletLeaderboard />
        </div>}  {/* end sidebar */}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '9px', color: C.textMuted, letterSpacing: '0.08em' }}>{label}</span>
      <select value={value} onChange={e => onChange(isNaN(e.target.value) ? e.target.value : Number(e.target.value))} style={{ background: '#0a0a14', border: `1px solid ${C.border}`, borderRadius: '4px', color: C.text, fontSize: '11px', padding: '4px 7px', cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
