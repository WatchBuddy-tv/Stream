# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context, RemoteProviderClient, plugin_manager
from urllib.parse import quote_plus
from types        import SimpleNamespace

@home_router.get("/icerik/{eklenti_adi}", response_class=HTMLResponse)
async def icerik(request: Request, eklenti_adi: str, url: str):
    context = await build_context(request)
    provider_url = context.get("provider_url")

    try:
        content = None
        if provider_url:
            async with RemoteProviderClient(provider_url) as client:
                content_data = await client.load_item(eklenti_adi, url)
                # Standardize content_data as an object or dict that template expects
                # Using Dots notation in template? Pages might expect attributes.
                # Let's use a simple namespace if it's a dict
                def dict_to_ns(d):
                    if isinstance(d, dict):
                        for k, v in d.items():
                            if isinstance(v, list):
                                d[k] = [dict_to_ns(i) for i in v]
                            elif isinstance(v, dict):
                                d[k] = dict_to_ns(v)
                        return SimpleNamespace(**d)
                    return d
                content = dict_to_ns(content_data)
                if not hasattr(content, 'url'):
                    content.url = url # fallback to request url if missing
        else:
            if eklenti_adi not in plugin_manager.get_plugin_names():
                raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

            plugin  = plugin_manager.select_plugin(eklenti_adi)
            content = await plugin.load_item(url)

        if hasattr(content, 'url') and content.url:
            content.url = quote_plus(str(content.url))

        if hasattr(content, "episodes") and content.episodes:
            for episode in content.episodes:
                episode.url = quote_plus(episode.url)

        context.update({
            "title"       : f"{eklenti_adi} - {content.title}",
            "description" : context["tr"]("content_desc", title=content.title),
            "title_key"   : "title_content",
            "title_vars"  : {"provider": eklenti_adi, "title": content.title},
            "desc_key"    : "content_desc",
            "desc_vars"   : {"title": content.title},
            "eklenti_adi" : eklenti_adi,
            "content"     : content
        })

        return home_template.TemplateResponse("pages/content.html.j2", context)
    except Exception as hata:
        context = await build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": eklenti_adi},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {eklenti_adi}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
