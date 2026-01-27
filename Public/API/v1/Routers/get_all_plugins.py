# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request
from .      import api_v1_router, api_v1_global_message
from ..Libs import plugin_manager

from urllib.parse import quote_plus

@api_v1_router.get("/get_all_plugins")
async def get_all_plugins(request: Request):
    """Tüm plugin detaylarını döndürür - Ana sayfa için optimize edilmiş endpoint"""
    plugin_names = plugin_manager.get_plugin_names()
    
    all_plugins = []
    for plugin_name in plugin_names:
        try:
            plugin = plugin_manager.select_plugin(plugin_name)
            
            main_page = {}
            for url, category in plugin.main_page.items():
                main_page[quote_plus(url)] = quote_plus(category)
            
            all_plugins.append({
                "name"        : plugin.name,
                "language"    : plugin.language,
                "main_url"    : plugin.main_url,
                "favicon"     : plugin.favicon,
                "description" : plugin.description,
                "main_page"   : main_page
            })
        except Exception:
            # Hatalı plugin'i atla
            continue
    
    return {**api_v1_global_message, "result": all_plugins}
