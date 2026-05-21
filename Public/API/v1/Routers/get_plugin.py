# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca

@api_v1_router.get("/get_plugin")
async def get_plugin(request:Request):
    result = await fuck_dmca("/get_plugin", params=request.state.veri)
    return {**api_v1_global_message, "result": result}
