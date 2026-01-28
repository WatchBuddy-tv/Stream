# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core     import Request
from .        import api_v1_router
from Settings import PROVIDER_NAME, PROVIDER_DESCRIPTION, PROXY_URL, PROXY_FALLBACK_URL

@api_v1_router.get("/schema")
async def get_schema(request: Request):
    """Provider Schema (Discovery) endpoint"""
    return {
        "provider_name"      : PROVIDER_NAME,
        "description"        : PROVIDER_DESCRIPTION,
        "proxy_url"          : PROXY_URL or str(request.base_url).rstrip("/"),
        "proxy_fallback_url" : PROXY_FALLBACK_URL
    }
