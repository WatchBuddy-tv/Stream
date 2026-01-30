# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context

from Public.API.v1.Libs import plugin_manager, SeriesInfo
from urllib.parse       import quote_plus

@home_router.get("/icerik/{eklenti_adi}", response_class=HTMLResponse)
async def icerik(request: Request, eklenti_adi: str, url: str):
    try:
        plugin_names = plugin_manager.get_plugin_names()

        if eklenti_adi not in plugin_names:
            raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

        plugin  = plugin_manager.select_plugin(eklenti_adi)
        content = await plugin.load_item(url)

        content.url = quote_plus(content.url)

        if isinstance(content, SeriesInfo):
            for episode in content.episodes:
                episode.url = quote_plus(episode.url)

        context = build_context(
            request     = request,
            title       = f"{eklenti_adi} - {content.title}",
            description = "",
            title_key   = "title_content",
            title_vars  = {"provider": eklenti_adi, "title": content.title},
            desc_key    = "content_desc",
            desc_vars   = {"title": content.title},
            eklenti_adi = eklenti_adi,
            content     = content
        )
        context["description"] = context["tr"]("content_desc", title=content.title)

        return home_template.TemplateResponse("pages/content.html.j2", context)
    except Exception as hata:
        context = build_context(
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
