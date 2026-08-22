# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core         import Request, HTMLResponse
from .            import home_router, home_template, build_context, get_provider_client, fuck_dmca, get_client_headers
from urllib.parse import quote_plus

@home_router.get("/ara/{eklenti_adi}", response_class=HTMLResponse)
async def ara(request: Request, eklenti_adi: str, sorgu: str):
    context      = await build_context(request)
    provider_url = context.get("provider_url")

    try:
        results = []
        if provider_url:
            client  = await get_provider_client(provider_url)
            results = await client.search(eklenti_adi, sorgu)
        else:
            results = await fuck_dmca("/search", params={
                "plugin" : eklenti_adi,
                "query"  : sorgu
            }, client_headers=get_client_headers(request))

        context.update({
            "title"       : context["tr"]("title_search", provider_name=context["provider_name"], provider=eklenti_adi, query=sorgu),
            "description" : context["tr"]("search_desc", provider=eklenti_adi, query=sorgu),
            "title_key"   : "title_search",
            "title_vars"  : {"provider_name": context["provider_name"], "provider": eklenti_adi, "query": sorgu},
            "desc_key"    : "search_desc",
            "desc_vars"   : {"provider": eklenti_adi, "query": sorgu},
            "eklenti_adi" : eklenti_adi,
            "sorgu"       : sorgu,
            "results"     : results
        })

        return home_template.TemplateResponse(request=request, name="pages/search_results.html.j2", context=context)
    except Exception as hata:
        context = await build_context(
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
        return home_template.TemplateResponse(request=request, name="pages/error.html.j2", context=context)
