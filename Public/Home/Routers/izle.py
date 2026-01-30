# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context

from Public.API.v1.Libs import plugin_manager
from Settings           import PROVIDER_NAME, PROXY_URL, PROXY_FALLBACK_URL
from urllib.parse       import urlparse, parse_qs

@home_router.get("/izle/{eklenti_adi}", response_class=HTMLResponse)
async def izle(request: Request, eklenti_adi: str, url: str, baslik: str):
    try:
        plugin_names = plugin_manager.get_plugin_names()

        if eklenti_adi not in plugin_names:
            raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

        plugin = plugin_manager.select_plugin(eklenti_adi)

        load_links = await plugin.load_links(url)

        links = []
        for link in load_links:
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

        context = build_context(
            request     = request,
            title       = baslik,
            description = "",
            title_key   = "title_player",
            title_vars  = {"title": baslik},
            desc_key    = "player_desc",
            desc_vars   = {"title": baslik},
            eklenti_adi = f"{eklenti_adi}",
            icerik_url  = icerik_url,
            links       = links,
            provider_name      = PROVIDER_NAME,
            proxy_url          = PROXY_URL or str(request.base_url).rstrip("/"),
            proxy_fallback_url = PROXY_FALLBACK_URL
        )
        context["description"] = context["tr"]("player_desc", title=baslik)

        return home_template.TemplateResponse("pages/player.html.j2", context)
    except Exception as hata:
        context = build_context(
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
