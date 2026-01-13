# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse, Depends
from .    import home_router, home_template
from Public.API.v1.Libs import plugin_manager

@home_router.get("/", response_class=HTMLResponse)
async def ana_sayfa(request: Request):

    plugins = []
    for name in plugin_manager.get_plugin_names():
        plugin = plugin_manager.select_plugin(name)

        # if plugin.name in ["Shorten", "JetFilmizle"]:
        #     continue

        plugins.append({
            "name"        : plugin.name,
            "description" : plugin.description,
            "language"    : plugin.language,
            "main_url"    : plugin.main_url,
            "favicon"     : plugin.favicon
        })

    context = {
        "request"     : request,
        "title"       : "KekikStream - Tüm Eklentiler",
        "description" : "KekikStream API Tüm Eklentiler Sayfası",
        "plugins"     : plugins
    }

    return home_template.TemplateResponse("pages/home.html.j2", context)
