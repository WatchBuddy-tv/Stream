# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca

@api_v1_router.get("/get_main_page")
async def get_main_page(request:Request):
    result = await fuck_dmca("/get_main_page", params=request.state.veri)
    return {**api_v1_global_message, "result": result}
