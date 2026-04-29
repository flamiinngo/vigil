# delphi.py — STUB (not wired up yet)
# Returns a placeholder URL so consensus.py can run without Delphi blocking it.
# Wire this up after AXL + Alchemy + consensus are confirmed working.

async def create_delphi_market(signal: dict) -> str | None:
    signal_id = signal.get("id", "unknown")
    print(f"[DELPHI] Stub — market creation skipped for now (signal: {signal_id})")
    return None
