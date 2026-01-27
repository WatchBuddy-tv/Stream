# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request, JSONResponse
from .      import api_v1_router, api_v1_global_message
from ..Libs import plugin_manager

import asyncio
from urllib.parse import quote_plus

@api_v1_router.get("/global_search")
async def global_search(request:Request):
    istek = request.state.veri
    _query = istek.get("query")
    
    if not _query:
        return JSONResponse(status_code=410, content={"hata": "Query parametresi eksik!"})

    plugin_names = plugin_manager.get_plugin_names()
    
    async def search_in_plugin(name):
        try:
            plugin = plugin_manager.select_plugin(name)
            results = await plugin.search(_query)
            for elem in results:
                elem.url = quote_plus(elem.url)
                elem.plugin = name # Eklenti adını kaydet
            return results
        except:
            return []

    # Tüm plugin'leri paralel ara
    tasks = [search_in_plugin(name) for name in plugin_names]
    all_results_lists = await asyncio.gather(*tasks)
    
    # Listeleri birleştir
    combined_results = []
    for results in all_results_lists:
        combined_results.extend(results)

    return {**api_v1_global_message, "result": combined_results}
