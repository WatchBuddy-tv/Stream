# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse, JSONResponse
from .    import home_router, home_template, build_context, RemoteProviderClient, plugin_manager
from urllib.parse import unquote

@home_router.get("/health")
@home_router.head("/health")
async def health_check():
    """API sağlık kontrolü"""
    return JSONResponse({"success": True, "status": "healthy"})

@home_router.get("/", response_class=HTMLResponse)
async def ana_sayfa(request: Request):
    context = await build_context(request)
    provider_url = context.get("provider_url")

    plugins = []
    if provider_url:
        async with RemoteProviderClient(provider_url) as client:
            plugins = await client.get_plugins()
    else:
        for name in plugin_manager.get_plugin_names():
            plugin = plugin_manager.select_plugin(name)
            plugins.append({
                "name"        : plugin.name,
                "description" : plugin.description,
                "language"    : plugin.language,
                "main_url"    : plugin.main_url,
                "favicon"     : plugin.favicon
            })

    context.update({
        "title"       : context["tr"]("home_title"),
        "description" : context["tr"]("home_desc"),
        "title_key"   : "home_title",
        "title_vars"  : {},
        "desc_key"    : "home_desc",
        "desc_vars"   : {},
        "plugins"     : plugins
    })

    response = home_template.TemplateResponse("pages/home.html.j2", context)

    # Query'den gelen provider varsa cookie'ye kaydet
    query_provider = request.query_params.get("provider")
    if query_provider:
        # URL decode et (JavaScript encodeURIComponent ile gelmiş olabilir)
        decoded_provider = unquote(query_provider.strip())
        response.set_cookie(key="provider_url", value=decoded_provider, max_age=31536000, samesite="lax") # 1 year

    return response
