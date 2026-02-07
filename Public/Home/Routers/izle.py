# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context, RemoteProviderClient, plugin_manager
from urllib.parse import urlparse, parse_qs
from Settings     import PROXY_URL, PROXY_FALLBACK_URL

@home_router.get("/izle/{eklenti_adi}", response_class=HTMLResponse)
async def izle(request: Request, eklenti_adi: str, url: str, baslik: str):
    context = await build_context(request)
    provider_url = context.get("provider_url")

    try:
        load_links_data = []

        if provider_url:
            async with RemoteProviderClient(provider_url) as client:
                load_links_data = await client.load_links(eklenti_adi, url)
                proxy_urls = await client.get_proxy_urls()
        else:
            # Local provider için Settings'den proxy bilgilerini al
            proxy_urls = {
                "proxy_url"          : PROXY_URL or str(request.base_url).rstrip("/"),
                "proxy_fallback_url" : PROXY_FALLBACK_URL
            }

            if eklenti_adi not in plugin_manager.get_plugin_names():
                raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

            plugin = plugin_manager.select_plugin(eklenti_adi)
            load_links_data = await plugin.load_links(url)

        links = []
        for link in load_links_data:
            # link might be an object or dict
            if isinstance(link, dict):
                links.append({
                    "name"       : link.get("name"),
                    "url"        : link.get("url"),
                    "referer"    : link.get("referer") or "",
                    "user_agent" : link.get("user_agent") or "",
                    "subtitles"  : link.get("subtitles") or []
                })
            else:
                subtitles = []
                if link.subtitles:
                    subtitles = [sub.model_dump() for sub in link.subtitles]

                links.append({
                    "name"       : link.name,
                    "url"        : link.url,
                    "referer"    : link.referer or "",
                    "user_agent" : link.user_agent or "",
                    "subtitles"  : subtitles
                })

        referer = request.headers.get("referer")
        icerik_url = None
        if referer:
            parsed = urlparse(referer)
            params = parse_qs(parsed.query)
            if "url" in params and params["url"]:
                icerik_url = params["url"][0]

        context.update({
            "title"       : context["tr"]("title_player", provider_name=context["provider_name"], title=baslik),
            "description" : context["tr"]("player_desc", title=baslik),
            "title_key"   : "title_player",
            "title_vars"  : {"provider_name": context["provider_name"], "title": baslik},
            "desc_key"    : "player_desc",
            "desc_vars"   : {"title": baslik},
            "eklenti_adi" : f"{eklenti_adi}",
            "baslik"      : baslik,
            "icerik_url"  : icerik_url,
            "links"       : links,
            "provider_name"      : context.get("provider_name"),
            "proxy_url"          : proxy_urls["proxy_url"],
            "proxy_fallback_url" : proxy_urls["proxy_fallback_url"]
        })

        return home_template.TemplateResponse("pages/player.html.j2", context)
    except Exception as hata:
        context = await build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": f"{eklenti_adi} - {baslik}"},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {eklenti_adi} - {baslik}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
