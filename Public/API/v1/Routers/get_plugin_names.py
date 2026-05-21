# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca

@api_v1_router.get("/get_plugin_names")
async def get_plugin_names(request: Request):
    result = await fuck_dmca("/get_plugin_names", params=request.state.veri)
    return {**api_v1_global_message, "result": result}
