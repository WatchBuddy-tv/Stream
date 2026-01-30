# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context

from Public.API.v1.Libs import plugin_manager
from urllib.parse       import quote_plus

@home_router.get("/eklenti/{eklenti_adi}", response_class=HTMLResponse)
async def eklenti(request: Request, eklenti_adi: str):
    try:
        plugin_name  = eklenti_adi
        plugin_names = plugin_manager.get_plugin_names()
        
        if eklenti_adi not in plugin_names:
            raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

        plugin      = plugin_manager.select_plugin(eklenti_adi)
        plugin_name = plugin.name

        main_page = {}
        for url, category in plugin.main_page.items():
            main_page[quote_plus(url)] = quote_plus(category)

        plugin = {
            "name"        : plugin.name,
            "language"    : plugin.language,
            "main_url"    : plugin.main_url,
            "favicon"     : plugin.favicon,
            "description" : plugin.description,
            "main_page"   : main_page
        }

        context = build_context(
            request     = request,
            title       = plugin.get("name"),
            description = "",
            title_key   = "title_plugin",
            title_vars  = {"name": plugin.get("name")},
            desc_key    = "plugin_page_desc",
            desc_vars   = {"name": plugin.get("name")},
            plugin      = plugin
        )
        context["description"] = context["tr"]("plugin_page_desc", name=plugin.get("name"))

        return home_template.TemplateResponse("pages/plugin_detail.html.j2", context)
    except Exception as hata:
        context = build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": plugin_name},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {plugin_name}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
