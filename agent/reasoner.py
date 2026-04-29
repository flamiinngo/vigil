# reasoner.py — Signal narrative generator
#
# Primary:  Groq API (free, cloud, no local install)
#           Model: llama3-8b-8192
#           Get free key: https://console.groq.com
#
# Fallback: Ollama (local, no key needed, useful for dev/offline)
#           Model: llama3
#
# Last resort: hardcoded fallback text (always works, no LLM needed)
#
# Ollama's only job here is writing ONE sentence for the dashboard.
# Signal detection is rule-based in consensus.py — no LLM involved.

import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL    = "llama-3.1-8b-instant"

OLLAMA_URL    = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL  = os.getenv("OLLAMA_MODEL", "llama3")

PROMPT = """You are a crypto on-chain analyst writing a one-line alert for a trading dashboard.
Write ONE sentence (max 20 words) summarizing this smart money signal. Be direct and specific.

Signal: {summary}

Respond with only the sentence. No quotes. No explanation."""


def _build_summary(signal: dict) -> str:
    uniswap  = signal.get("uniswap", {})
    symbol   = uniswap.get("symbol", "")
    token    = f"${symbol}" if symbol else signal.get("token_address", "")[:10] + "..."
    wallets  = len(signal.get("wallets", []))
    nodes    = signal.get("node_count", 0)
    liq      = uniswap.get("liquidity_usd", 0)
    change   = uniswap.get("price_change_24h_pct", 0)
    return (f"token={token} wallets={wallets} nodes={nodes} "
            f"liquidity=${liq:,.0f} price_change_24h={change:+.1f}%")


def _fallback(signal: dict) -> str:
    uniswap  = signal.get("uniswap", {})
    symbol   = uniswap.get("symbol", "")
    token    = f"${symbol}" if symbol else signal.get("token_address", "")[:10] + "..."
    wallets  = len(signal.get("wallets", []))
    nodes    = signal.get("node_count", 0)
    return (f"{wallets} smart money wallet{'s' if wallets != 1 else ''} entered "
            f"{token} — confirmed by {nodes} independent node{'s' if nodes != 1 else ''}.")


async def generate_narrative(signal: dict) -> str:
    """
    Generate a one-sentence signal narrative.
    Tries Groq first, falls back to Ollama, then to hardcoded text.
    """
    summary = _build_summary(signal)
    prompt  = PROMPT.format(summary=summary)

    # ── Try Groq (primary) ──────────────────────────────────────────────────
    if GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    GROQ_URL,
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 60,
                        "temperature": 0.3,
                    },
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                text = (resp.json()
                        .get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                        .strip('"')
                        .strip("'")
                        .split("\n")[0]
                        .strip())
                if text:
                    print(f"[REASONER] Groq: {text}")
                    return text

        except httpx.HTTPStatusError as e:
            print(f"[REASONER] Groq HTTP error {e.response.status_code} — trying Ollama")
        except Exception as e:
            print(f"[REASONER] Groq error: {e} — trying Ollama")
    else:
        print("[REASONER] No GROQ_API_KEY — trying Ollama")

    # ── Try Ollama (local fallback) ─────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 60},
                },
            )
            resp.raise_for_status()
            text = (resp.json()
                    .get("response", "")
                    .strip()
                    .strip('"')
                    .strip("'")
                    .split("\n")[0]
                    .strip())
            if text:
                print(f"[REASONER] Ollama: {text}")
                return text

    except httpx.ConnectError:
        print("[REASONER] Ollama not running — using fallback text")
    except Exception as e:
        print(f"[REASONER] Ollama error: {e} — using fallback text")

    # ── Hardcoded fallback (always works) ───────────────────────────────────
    text = _fallback(signal)
    print(f"[REASONER] Fallback: {text}")
    return text
