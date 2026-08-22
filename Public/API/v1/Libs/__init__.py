# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from httpx   import AsyncClient, HTTPStatusError, TimeoutException
from fastapi import Request
from typing  import Any
import asyncio, os, time

_client  = AsyncClient()
_default = os.getenv("DEFAULT_PROVIDER_URL", "http://px-webservisler:8596")

def get_client_headers(request: Request) -> dict[str, str]:
    """İstemci kimlik header'larını provider'a taşımak üzere hazırlar."""
    headers    : dict[str, str] = {}
    fw_for                      = request.headers.get("X-Forwarded-For")
    client_ip                   = fw_for.split(",")[0].strip() if fw_for else (request.client.host if request.client else None)
    user_agent                  = request.headers.get("X-Original-User-Agent") or request.headers.get("User-Agent")
    referer                     = request.headers.get("X-Original-Referer") or request.headers.get("Referer")
    origin                      = request.headers.get("X-Original-Origin") or request.headers.get("Origin")

    if client_ip:
        headers["X-Forwarded-For"] = client_ip
    if user_agent:
        headers["User-Agent"]            = user_agent
        headers["X-Original-User-Agent"] = user_agent
    if referer:
        headers["Referer"]            = referer
        headers["X-Original-Referer"] = referer
    if origin:
        headers["Origin"]            = origin
        headers["X-Original-Origin"] = origin

    return headers


# Sadece "liste/detay" endpoint'leri cache'lenir - load_links/extract/ytdlp-extract
# gibi süresi kısa token/link üreten endpoint'ler her seferinde taze çekilmeli.
_CACHE_TTL = {
    "/get_main_page"    : 1800,  # 30 dk
    "/load_item"        : 3600,  # 1 sa - plugin katmanıyla uyumlu
    "/search"           : 300,   # 5 dk
    "/get_plugin"       : 3600,
    "/get_all_plugins"  : 3600,
    "/get_plugin_names" : 3600,
}
_CACHE_MAX_ENTRIES = 512

_cache    : dict[str, tuple[float, Any]] = {}
_inflight : dict[str, asyncio.Task]      = {}


class ProviderRequestError(Exception):
    """Provider durumunu API istemcilerine kontrollü biçimde taşır."""

    def __init__(self, status_code: int, endpoint: str):
        self.status_code = status_code
        self.endpoint    = endpoint
        super().__init__(f"Provider hatası ({status_code}): {endpoint}")

def _cache_key(endpoint: str, params: dict | None) -> str:
    return f"{endpoint}?{sorted((params or {}).items())}"

def _prune(cache: dict, max_entries: int):
    now     = time.monotonic()
    expired = [k for k, (exp, _) in cache.items() if exp <= now]
    for k in expired:
        cache.pop(k, None)

    overflow = len(cache) - max_entries
    if overflow > 0:
        for key in list(cache.keys())[:overflow]:
            cache.pop(key, None)

async def _fetch(
    endpoint: str,
    params: dict | None,
    timeout: float | None,
    client_headers: dict[str, str] | None = None,
):
    try:
        headers = client_headers or {}
        req     = await _client.get(f"{_default}/api/v1{endpoint}", params=params, timeout=timeout, headers=headers)
        req.raise_for_status()
        return req.json().get("result")
    except TimeoutException:
        raise ValueError(f"Provider zaman aşımı: {endpoint}")
    except HTTPStatusError as e:
        raise ProviderRequestError(e.response.status_code, endpoint) from e
    except Exception as e:
        raise ValueError(f"Provider bağlantı hatası: {e}")

async def fuck_dmca(
    endpoint: str,
    params: dict | None = None,
    timeout: float | None = None,
    client_headers: dict[str, str] | None = None,
):
    ttl = _CACHE_TTL.get(endpoint)
    if not ttl:
        return await _fetch(endpoint, params, timeout, client_headers)

    key   = _cache_key(endpoint, params)
    entry = _cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]

    if key in _inflight:
        return await _inflight[key]

    async def _do_fetch():
        result = await _fetch(endpoint, params, timeout, client_headers)
        if result:
            _cache[key] = (time.monotonic() + ttl, result)
            _prune(_cache, _CACHE_MAX_ENTRIES)
        return result

    task = asyncio.create_task(_do_fetch())
    _inflight[key] = task
    try:
        return await task
    finally:
        _inflight.pop(key, None)
