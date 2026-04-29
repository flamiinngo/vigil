import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

const C = {
  bg: '#070710', surface: '#0d0d1a', border: '#1a1a2e',
  purple: '#7c3aed', green: '#22c55e', orange: '#f97316',
  blue: '#38bdf8', yellow: '#f59e0b', red: '#ef4444',
  text: '#e2e8f0', textDim: '#64748b', textMuted: '#334155',
};

const QUOTER_V2    = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const SWAP_ROUTER  = '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45';
const WETH         = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
];

const FEE_TIERS = [100, 500, 3000, 10000];

function fmtAmount(raw, decimals) {
  if (raw == null) return '...';
  const n = Number(ethers.formatUnits(raw, decimals));
  if (n >= 1e9) return `${(n / 1e9).toFixed(3)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(3)}M`;
  if (n >= 1e3) return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return n.toFixed(4);
}

export default function SwapModal({ signal, wallet, onClose }) {
  const sym = signal.uniswap?.symbol || signal.token_address.slice(0, 8) + '...';
  const tokenAddress = signal.token_address;

  const [ethAmount, setEthAmount]       = useState('0.1');
  const [quote, setQuote]               = useState(null);
  const [bestFee, setBestFee]           = useState(3000);
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [quoting, setQuoting]           = useState(false);
  const [swapping, setSwapping]         = useState(false);
  const [txHash, setTxHash]             = useState(null);
  const [error, setError]               = useState(null);
  const [noPool, setNoPool]             = useState(false);
  const debounce = useRef(null);

  // Load token decimals once
  useEffect(() => {
    if (!window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    token.decimals().then(d => setTokenDecimals(Number(d))).catch(() => {});
  }, [tokenAddress]);

  // Debounced quote on amount change
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce.current);
  }, [ethAmount]);

  async function fetchQuote() {
    const amt = parseFloat(ethAmount);
    if (!amt || amt <= 0) { setQuote(null); setNoPool(false); return; }
    if (!window.ethereum) { setError('MetaMask not detected'); return; }

    setQuoting(true);
    setError(null);
    setNoPool(false);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const quoter = new ethers.Contract(QUOTER_V2, QUOTER_ABI, provider);
      const amountIn = ethers.parseEther(ethAmount);

      let best = null, bestFeeFound = 3000;
      for (const fee of FEE_TIERS) {
        try {
          const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
            tokenIn: WETH,
            tokenOut: tokenAddress,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          });
          if (best === null || amountOut > best) {
            best = amountOut;
            bestFeeFound = fee;
          }
        } catch (_) {}
      }

      if (best !== null) {
        setQuote(best);
        setBestFee(bestFeeFound);
        setNoPool(false);
      } else {
        setQuote(null);
        setNoPool(true);
      }
    } catch (e) {
      setError('Quote failed: ' + (e.shortMessage || e.message || 'unknown error'));
    }
    setQuoting(false);
  }

  async function executeSwap() {
    if (!quote || !wallet) return;
    setSwapping(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const router = new ethers.Contract(SWAP_ROUTER, ROUTER_ABI, signer);
      const amountIn = ethers.parseEther(ethAmount);
      const minOut = quote * 95n / 100n; // 5% slippage tolerance

      const tx = await router.exactInputSingle(
        {
          tokenIn: WETH,
          tokenOut: tokenAddress,
          fee: bestFee,
          recipient: wallet,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
        { value: amountIn }
      );
      setTxHash(tx.hash);
    } catch (e) {
      setError(e.shortMessage || e.reason || e.message || 'Transaction rejected');
    }
    setSwapping(false);
  }

  const feePct = bestFee / 10000;
  const pricePerEth = quote
    ? Number(ethers.formatUnits(quote, tokenDecimals)) / parseFloat(ethAmount || '1')
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999, backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: '12px', width: '420px', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: C.text }}>Swap for ${sym}</div>
            <div style={{ fontSize: '11px', color: C.textDim, marginTop: '2px' }}>
              via Uniswap v3 · {feePct}% fee
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', color: C.textDim, fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* You pay */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.08em', marginBottom: '6px' }}>YOU PAY</div>
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: '8px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ethAmount}
                onChange={e => setEthAmount(e.target.value)}
                style={{
                  background: 'none', border: 'none', color: C.text,
                  fontSize: '22px', fontWeight: '700', width: '60%',
                  fontFamily: 'inherit',
                }}
                placeholder="0.0"
              />
              <div style={{
                background: '#1a1a2e', border: `1px solid ${C.border}`,
                borderRadius: '6px', padding: '6px 12px',
                fontSize: '14px', fontWeight: '700', color: C.text,
              }}>ETH</div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ textAlign: 'center', color: C.textDim, fontSize: '18px', margin: '4px 0', userSelect: 'none' }}>↓</div>

          {/* You receive */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.08em', marginBottom: '6px' }}>YOU RECEIVE</div>
            <div style={{
              background: C.bg, border: `1px solid ${quoting ? C.purple + '60' : C.border}`,
              borderRadius: '8px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: quoting ? C.textDim : C.green }}>
                {quoting ? '...' : quote ? `≈ ${fmtAmount(quote, tokenDecimals)}` : '—'}
              </div>
              <div style={{
                background: '#1a1030', border: `1px solid ${C.purple}40`,
                borderRadius: '6px', padding: '6px 12px',
                fontSize: '14px', fontWeight: '700', color: '#a78bfa',
              }}>${sym}</div>
            </div>
          </div>

          {/* Rate info */}
          {pricePerEth && (
            <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '12px', textAlign: 'center' }}>
              1 ETH ≈ {pricePerEth.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sym}
              <span style={{ color: C.textMuted, marginLeft: '8px' }}>· 5% max slippage</span>
            </div>
          )}

          {/* No direct pool — graceful fallback */}
          {noPool && (
            <div style={{
              background: '#0a0a14', border: `1px solid ${C.border}`,
              borderRadius: '8px', padding: '16px',
              marginBottom: '12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '12px', lineHeight: '1.5' }}>
                No direct ETH→${sym} pool on Uniswap v3.<br />
                This token may route through USDC or exist on another DEX.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={`https://app.uniswap.org/swap?outputCurrency=${tokenAddress}&chain=mainnet`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    flex: 1, display: 'block', textAlign: 'center',
                    padding: '11px 0', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    color: '#fff', fontSize: '13px', fontWeight: '700',
                  }}
                >
                  Open in Uniswap ↗
                </a>
                <a
                  href={`https://dexscreener.com/ethereum/${tokenAddress}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    flex: 1, display: 'block', textAlign: 'center',
                    padding: '11px 0', borderRadius: '8px',
                    background: C.bg, border: `1px solid ${C.border}`,
                    color: C.textDim, fontSize: '13px', fontWeight: '600',
                  }}
                >
                  Chart ↗
                </a>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div style={{
              background: '#1a0808', border: `1px solid #7f1d1d`,
              borderRadius: '6px', padding: '10px 12px',
              fontSize: '12px', color: '#fca5a5', marginBottom: '12px',
            }}>
              {error}
            </div>
          )}

          {/* TX success */}
          {txHash && (
            <div style={{
              background: '#052e16', border: `1px solid #166534`,
              borderRadius: '6px', padding: '12px',
              marginBottom: '12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', color: C.green, fontWeight: '600', marginBottom: '4px' }}>Transaction submitted</div>
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#4ade80', textDecoration: 'underline' }}
              >
                View on Etherscan →
              </a>
            </div>
          )}

          {/* Action button — hidden when no pool or tx already sent */}
          {!txHash && !noPool && (
            <button
              onClick={executeSwap}
              disabled={!wallet || !quote || swapping || quoting}
              style={{
                width: '100%', padding: '14px',
                background: !wallet || !quote
                  ? C.textMuted
                  : swapping
                    ? C.purple + '80'
                    : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff', borderRadius: '8px',
                fontSize: '14px', fontWeight: '700',
                cursor: !wallet || !quote ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                opacity: swapping ? 0.7 : 1,
              }}
            >
              {!wallet
                ? 'Connect wallet first'
                : quoting
                  ? 'Getting quote...'
                  : !quote
                    ? 'Enter amount'
                    : swapping
                      ? 'Confirm in MetaMask...'
                      : `Swap ${ethAmount} ETH → ${fmtAmount(quote, tokenDecimals)} $${sym}`}
            </button>
          )}

          {!noPool && (
            <div style={{ fontSize: '10px', color: C.textMuted, textAlign: 'center', marginTop: '10px' }}>
              Executes directly through Uniswap v3 SwapRouter · Non-custodial
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
