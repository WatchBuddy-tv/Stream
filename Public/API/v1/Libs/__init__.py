# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from httpx import AsyncClient
import os

_client  = AsyncClient()
_default = os.getenv("DEFAULT_PROVIDER_URL", "http://px-webservisler:8596")

async def fuck_dmca(endpoint: str, params: dict | None = None):
    req  = await _client.get(f"{_default}/api/v1{endpoint}", params=params)
    resp = req.json()
    return resp.get("result")
