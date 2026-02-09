# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse, JSONResponse
from .    import home_router, home_template, build_context, RemoteProviderClient, plugin_manager

@home_router.get("/health")
@home_router.head("/health")
async def health_check():
    """API sağlık kontrolü"""
    return JSONResponse({"success": True, "status": "healthy"})

@home_router.get("/", response_class=HTMLResponse)
async def ana_sayfa(request: Request):
    """Ana sayfa - Tüm eklentileri listeler"""
    context = await build_context(request)
    provider_url = context.get("provider_url")

    plugins = []
    try:
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
            "title"       : context["tr"]("home_title", provider_name=context["provider_name"]),
            "description" : context["tr"]("home_desc"),
            "title_key"   : "home_title",
            "title_vars"  : {"provider_name": context["provider_name"]},
            "desc_key"    : "home_desc",
            "desc_vars"   : {},
            "plugins"     : plugins
        })

        response = home_template.TemplateResponse("pages/home.html.j2", context)

        # Query'den gelen provider varsa cookie'ye kaydet (Normalleştirilmiş URL'i kaydet)
        if provider_url and request.query_params.get("provider"):
            response.set_cookie(key="provider_url", value=provider_url, max_age=31536000, samesite="lax") # 1 year

        return response
    except Exception as hata:
        context = await build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": context["provider_name"]},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {context['provider_name']}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
