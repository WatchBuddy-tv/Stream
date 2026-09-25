# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from ipaddress import ip_address, ip_network

_TAILSCALE_NET = ip_network("100.64.0.0/10")


def _is_trusted_peer(host: str) -> bool:
    try:
        addr = ip_address(host)
    except ValueError:
        return False
    return addr.is_private or addr.is_loopback or addr in _TAILSCALE_NET


def resolve_client_ip(conn) -> str:
    peer = conn.client.host if conn.client else ""
    if not _is_trusted_peer(peer):
        return peer

    cf_ip = (conn.headers.get("cf-connecting-ip") or "").strip()
    if cf_ip:
        return cf_ip
    fw_for = conn.headers.get("x-forwarded-for") or ""
    return fw_for.split(",")[0].strip() or peer
