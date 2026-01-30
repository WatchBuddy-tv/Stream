# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context

from Public.API.v1.Libs import plugin_manager
from urllib.parse       import quote_plus

@home_router.get("/kategori/{eklenti_adi}", response_class=HTMLResponse)
async def kategori(request: Request, eklenti_adi: str, kategori_url: str, kategori_adi: str, sayfa: int = 1):
    try:
        plugin_names = plugin_manager.get_plugin_names()
        
        if eklenti_adi not in plugin_names:
            raise ValueError(f"'{eklenti_adi}' Bulunamadı!")

        plugin = plugin_manager.select_plugin(eklenti_adi)
        items  = await plugin.get_main_page(sayfa, kategori_url, kategori_adi)
        for icerik in items:
            icerik.url = quote_plus(icerik.url)

        context = build_context(
            request      = request,
            title        = f"{eklenti_adi} - {kategori_adi}",
            description  = "",
            title_key    = "title_category",
            title_vars   = {"provider": eklenti_adi, "category": kategori_adi},
            desc_key     = "category_desc",
            desc_vars    = {"provider": eklenti_adi, "category": kategori_adi},
            eklenti_adi  = eklenti_adi,
            baslik       = kategori_adi,
            items        = items,
            kategori_url = quote_plus(kategori_url),
            kategori_adi = quote_plus(kategori_adi),
            sayfa        = sayfa
        )
        context["description"] = context["tr"]("category_desc", provider=eklenti_adi, category=kategori_adi)

        return home_template.TemplateResponse("pages/category.html.j2", context)
    except Exception as hata:
        context = build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": f"{eklenti_adi} - {kategori_adi}"},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata
        )
        context["title"]       = f"{context['tr']('error_title')} - {eklenti_adi} - {kategori_adi}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse("pages/error.html.j2", context)
