# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import fuck_dmca

@api_v1_router.get("/get_all_plugins")
async def get_all_plugins(request: Request):
    """Tüm plugin detaylarını döndürür - Ana sayfa için optimize edilmiş endpoint"""
    result = await fuck_dmca("/get_all_plugins", params=request.state.veri)
    return {**api_v1_global_message, "result": result}
