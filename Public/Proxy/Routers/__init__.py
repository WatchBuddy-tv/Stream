# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi  import APIRouter, Request, HTTPException, Depends
from Core     import Request
from Settings import PROXY_URL, PROXY_FALLBACK_URL

async def check_proxy_disabled():
    if PROXY_URL or PROXY_FALLBACK_URL:
        raise HTTPException(status_code=403, detail="Proxy endpoint is disabled because an external PROXY_URL is configured.")

proxy_router         = APIRouter(prefix="/proxy", dependencies=[Depends(check_proxy_disabled)])
proxy_global_message = {
    "with" : "https://github.com/keyiflerolsun/KekikStream"
}

@proxy_router.get("")
async def get_proxy_router(request: Request):
    return proxy_global_message

from . import video, subtitle
