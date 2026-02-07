# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context, RemoteProviderClient, plugin_manager
from urllib.parse import quote_plus

@home_router.get("/eklenti/{eklenti_adi}", response_class=HTMLResponse)
async def eklenti(request: Request, eklenti_adi: str):
    context = await build_context(request)
    provider_url = context.get("provider_url")

    try:
        if provider_url:
            async with RemoteProviderClient(provider_url) as client:
                plugin = await client.get_plugin(eklenti_adi)
                if not plugin:
                    raise ValueError(f"'{eklenti_adi}' Bulunamadı!")
        else:
            if eklenti_adi not in plugin_manager.get_plugin_names():
                raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

            local_plugin = plugin_manager.select_plugin(eklenti_adi)
            main_page = {}
            for url, category in local_plugin.main_page.items():
                main_page[quote_plus(url)] = quote_plus(category)

            plugin = {
                "name"        : local_plugin.name,
                "language"    : local_plugin.language,
                "main_url"    : local_plugin.main_url,
                "favicon"     : local_plugin.favicon,
                "description" : local_plugin.description,
                "main_page"   : main_page
            }

        context.update({
            "title"       : plugin.get("name"),
            "description" : context["tr"]("plugin_page_desc", name=plugin.get("name")),
            "title_key"   : "title_plugin",
            "title_vars"  : {"name": plugin.get("name")},
            "desc_key"    : "plugin_page_desc",
            "desc_vars"   : {"name": plugin.get("name")},
            "plugin"      : plugin
        })

        return home_template.TemplateResponse("pages/plugin_detail.html.j2", context)
    except Exception as hata:
        context = await build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": plugin.get("name") if plugin else eklenti_adi},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {plugin.get('name') if plugin else eklenti_adi}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
