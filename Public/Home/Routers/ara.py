# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context

from Public.API.v1.Libs import plugin_manager
from urllib.parse       import quote_plus

@home_router.get("/ara/{eklenti_adi}", response_class=HTMLResponse)
async def ara(request: Request, eklenti_adi: str, sorgu: str):
    try:
        plugin_names = plugin_manager.get_plugin_names()

        if eklenti_adi not in plugin_names:
            raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

        plugin = plugin_manager.select_plugin(eklenti_adi)
        results = await plugin.search(sorgu)

        for elem in results:
            elem.url = quote_plus(elem.url)

        context = build_context(
            request     = request,
            title       = f"{eklenti_adi} - {sorgu}",
            description = "",
            title_key   = "title_search",
            title_vars  = {"provider": eklenti_adi, "query": sorgu},
            desc_key    = "search_desc",
            desc_vars   = {"provider": eklenti_adi, "query": sorgu},
            eklenti_adi = eklenti_adi,
            sorgu       = sorgu,
            results     = results
        )
        context["description"] = context["tr"]("search_desc", provider=eklenti_adi, query=sorgu)

        return home_template.TemplateResponse("pages/search_results.html.j2", context)
    except Exception as hata:
        context = build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": f"{eklenti_adi} - {sorgu}"},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {eklenti_adi} - {sorgu}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
