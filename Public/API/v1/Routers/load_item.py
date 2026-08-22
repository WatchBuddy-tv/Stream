# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca, get_client_headers

@api_v1_router.get("/load_item")
async def load_item(request:Request):
    result = await fuck_dmca("/load_item", params=request.state.veri, client_headers=get_client_headers(request))
    return {**api_v1_global_message, "result": result}
