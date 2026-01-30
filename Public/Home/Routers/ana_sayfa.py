# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse, JSONResponse
from .    import home_router, home_template, build_context
from Public.API.v1.Libs import plugin_manager

@home_router.get("/health")
@home_router.head("/health")
async def health_check():
    """API sağlık kontrolü"""
    return JSONResponse({"success": True, "status": "healthy"})

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

    context = build_context(
        request     = request,
        title       = "",
        description = "",
        title_key   = "home_title",
        title_vars  = {},
        desc_key    = "home_desc",
        desc_vars   = {},
        plugins     = plugins
    )
    context["title"]       = context["tr"]("home_title")
    context["description"] = context["tr"]("home_desc")

    return home_template.TemplateResponse("pages/home.html.j2", context)
