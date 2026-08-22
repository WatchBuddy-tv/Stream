# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca, get_client_headers

@api_v1_router.get("/load_links")
async def load_links(request:Request):
    result = await fuck_dmca("/load_links", params=request.state.veri, timeout=10.0, client_headers=get_client_headers(request))
    return {**api_v1_global_message, "result": result}
