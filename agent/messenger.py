# messenger.py — Gensyn AXL peer-to-peer communication
#
# AXL API (localhost:9002) — actual spec from https://github.com/gensyn-ai/axl/blob/main/docs/api.md
#
#   GET  /topology          → {address, public_key, peers: [{peer_id, address}]}
#   POST /send              → headers: X-Destination-Peer-Id (64-char hex ed25519 pubkey)
#                             body: raw bytes (we send JSON-encoded payload)
#                             response: 200 + X-Sent-Bytes header
#   GET  /recv              → 204 if queue empty
#                             200 + X-From-Peer-Id header + raw binary body if message waiting

import json
import os
import time
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

AXL_BASE_URL = os.getenv("AXL_URL", "http://amusing-gentleness.railway.internal:9002")
NODE_ID = os.getenv("NODE_ID", "vigil-node-1")

# Remote Vigil node HTTP APIs — fetch their AXL public keys so we can send to them
# e.g. VIGIL_NETWORK_URL=https://viigil.up.railway.app
REMOTE_VIGIL_URLS = [u.strip() for u in os.getenv("VIGIL_NETWORK_URL", "").split(",") if u.strip()]

# Cache of peer IDs discovered from /topology + remote nodes
_known_peers: list[str] = []
_last_topology_refresh: float = 0.0
TOPOLOGY_REFRESH_INTERVAL = 30.0  # seconds

# Deduplicate received messages (keyed by sender + timestamp hash)
_seen_message_keys: set = set()


async def _fetch_remote_peer_key(url: str) -> str | None:
    """Fetch the AXL public key of a remote Vigil node via its /axl-status endpoint."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{url.rstrip('/')}/axl-status")
            data = r.json()
            key = data.get("our_public_key", "")
            if data.get("online") and key:
                return key
    except Exception:
        pass
    return None


async def refresh_topology() -> list[str]:
    """
    Fetch connected peers from AXL /topology + any remote Vigil nodes.
    Returns a list of peer_id strings (64-char hex ed25519 public keys).
    """
    global _known_peers, _last_topology_refresh

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{AXL_BASE_URL}/topology")
            response.raise_for_status()
            data = response.json()

        peers_raw = data.get("peers", [])
        our_key = data.get("our_public_key", "")
        peer_ids = []
        for p in peers_raw:
            if isinstance(p, str):
                peer_ids.append(p)
            elif isinstance(p, dict):
                pid = (p.get("public_key")
                       or p.get("PublicKey")
                       or p.get("peer_id")
                       or p.get("id"))
                if pid:
                    peer_ids.append(pid)

        # Discover remote Vigil nodes and add their AXL keys
        for url in REMOTE_VIGIL_URLS:
            remote_key = await _fetch_remote_peer_key(url)
            if remote_key and remote_key != our_key and remote_key not in peer_ids:
                peer_ids.append(remote_key)
                print(f"[MESSENGER] Discovered remote Vigil node: {remote_key[:12]}... via {url}")

        _known_peers = peer_ids
        _last_topology_refresh = time.time()

        if peer_ids:
            print(f"[MESSENGER] AXL online — our key: {our_key[:12]}... "
                  f"peers: {len(peer_ids)}")
        else:
            print(f"[MESSENGER] AXL online — our key: {our_key[:12]}... "
                  f"no peers connected yet")

        return peer_ids

    except httpx.ConnectError:
        print(f"[MESSENGER] AXL not reachable at {AXL_BASE_URL} — is `axl start` running?")
        return []
    except Exception as e:
        print(f"[MESSENGER] Topology fetch error: {e}")
        return []


async def get_peers() -> list[str]:
    """Return cached peer list, refreshing if stale."""
    if time.time() - _last_topology_refresh > TOPOLOGY_REFRESH_INTERVAL or not _known_peers:
        await refresh_topology()
    return _known_peers


async def send_observation(observation: dict) -> bool:
    """
    Broadcast an observation to all known peers via AXL /send.
    AXL /send requires:
      - Header: X-Destination-Peer-Id = peer's 64-char hex ed25519 public key
      - Body: raw bytes (we encode our JSON payload as UTF-8 bytes)
    Returns True if at least one peer received the message.
    """
    peers = await get_peers()

    if not peers:
        print("[MESSENGER] No peers to broadcast to — observation held locally")
        return False

    payload = {
        "node_id": NODE_ID,
        "type": "observation",
        "timestamp": time.time(),
        "data": observation,
    }
    raw_body = json.dumps(payload).encode("utf-8")

    token_short = str(observation.get("token_address", "unknown"))[:12]
    print(f"[MESSENGER] Broadcasting to {len(peers)} peer(s) — token {token_short}...")

    success_count = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for peer_id in peers:
            try:
                response = await client.post(
                    f"{AXL_BASE_URL}/send",
                    content=raw_body,
                    headers={
                        "X-Destination-Peer-Id": peer_id,
                        "Content-Type": "application/octet-stream",
                    },
                )
                if response.status_code == 200:
                    sent_bytes = response.headers.get("X-Sent-Bytes", "?")
                    print(f"[MESSENGER] Sent to {peer_id[:12]}... ({sent_bytes} bytes)")
                    success_count += 1
                else:
                    print(f"[MESSENGER] Send to {peer_id[:12]}... failed: HTTP {response.status_code}")
            except Exception as e:
                print(f"[MESSENGER] Send to {peer_id[:12]}... error: {e}")

    return success_count > 0


async def receive_observations() -> list[dict]:
    """
    Drain AXL /recv queue and return decoded Vigil observation messages.
    AXL /recv behavior:
      - 204 No Content → queue empty, return []
      - 200 OK         → binary body (our JSON payload) + X-From-Peer-Id header
    We call it in a loop until we get 204 to drain all queued messages.
    """
    new_observations = []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Drain all queued messages in one poll cycle
            while True:
                response = await client.get(f"{AXL_BASE_URL}/recv")

                if response.status_code == 204:
                    break  # Queue empty

                if response.status_code != 200:
                    print(f"[MESSENGER] /recv unexpected status: {response.status_code}")
                    break

                from_peer = response.headers.get("X-From-Peer-Id", "unknown")
                raw_body = response.content

                try:
                    msg = json.loads(raw_body.decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Not a Vigil message — skip silently (could be MCP/A2A traffic)
                    continue

                # Skip our own messages
                if msg.get("node_id") == NODE_ID:
                    continue

                # Deduplicate
                msg_key = f"{from_peer}_{msg.get('timestamp', 0)}"
                if msg_key in _seen_message_keys:
                    continue
                _seen_message_keys.add(msg_key)

                if msg.get("type") == "observation":
                    obs = msg.get("data", {})
                    obs["_from_node"] = msg.get("node_id", from_peer[:12])
                    new_observations.append(obs)
                    token_short = str(obs.get("token_address", "unknown"))[:12]
                    print(f"[MESSENGER] Received observation from {obs['_from_node']} "
                          f"— token {token_short}...")

    except httpx.ConnectError:
        pass  # AXL not running — silent during startup
    except Exception as e:
        print(f"[MESSENGER] Receive error: {e}")

    return new_observations


async def poll_loop(incoming_queue: asyncio.Queue, interval: float = 3.0):
    """Continuously poll AXL for inbound peer observations and enqueue them."""
    print(f"[MESSENGER] Polling AXL every {interval}s for peer messages...")
    # Initial topology fetch
    await refresh_topology()

    while True:
        observations = await receive_observations()
        for obs in observations:
            await incoming_queue.put(obs)
        await asyncio.sleep(interval)
