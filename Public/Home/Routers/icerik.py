# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, HTMLResponse
from .    import home_router, home_template, build_context, get_provider_client, fuck_dmca, get_client_headers

from json         import loads, dumps
from urllib.parse import quote_plus, unquote, unquote_plus
from types        import SimpleNamespace
from uuid         import NAMESPACE_URL, uuid5


def _normalize_encoded_payload(value: str | None) -> str:
    if not value:
        return ""

    # JSON payload kontrolü
    try:
        parsed = loads(value)
        return dumps(parsed, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        pass

    # JSON değilse sadece bir tur unquote_plus yeterli (FastAPI zaten unquote yapmış olabilir)
    return unquote_plus(str(value))


@home_router.get("/icerik/{eklenti_adi}", response_class=HTMLResponse)
async def icerik(request: Request, eklenti_adi: str, url: str):
    context           = await build_context(request)
    provider_url      = context.get("provider_url")
    provider_base_url = (provider_url or str(request.base_url)).strip().rstrip("/")
    provider_id       = (
        str(uuid5(NAMESPACE_URL, provider_base_url)) if provider_base_url else ""
    )

    try:
        normalized_url = _normalize_encoded_payload(url)
        content        = None
        if provider_url:
            client       = await get_provider_client(provider_url)
            content_data = await client.load_item(eklenti_adi, normalized_url)
        else:
            content_data = await fuck_dmca("/load_item", params={
                "plugin"      : eklenti_adi,
                "encoded_url" : normalized_url
            }, client_headers=get_client_headers(request))


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
        if not hasattr(content, "url"):
            content.url = normalized_url  # fallback to request url if missing


        if hasattr(content, "episodes") and content.episodes:
            safe_episodes    = [ep for ep in content.episodes if ep is not None]
            content.episodes = safe_episodes

        context.update(
            {
                "title": context["tr"](
                    "title_content",
                    provider_name = context["provider_name"],
                    provider      = eklenti_adi,
                    title         = content.title,
                ),
                "description"   : context["tr"]("content_desc", title=content.title),
                "title_key"     : "title_content",
                "title_vars"    : {
                    "provider_name" : context["provider_name"],
                    "provider"      : eklenti_adi,
                    "title"         : content.title,
                },
                "desc_key"    : "content_desc",
                "desc_vars"   : {"title": content.title},
                "eklenti_adi" : eklenti_adi,
                "content"     : content,
                "provider_id" : provider_id,
            }
        )

        return home_template.TemplateResponse(request=request, name="pages/content.html.j2", context=context)
    except Exception as hata:
        context = await build_context(
            request     = request,
            title       = "",
            description = "",
            title_key   = "title_error",
            title_vars  = {"context": eklenti_adi},
            desc_key    = "error_desc",
            desc_vars   = {},
            hata        = hata,
        )
        context["title"] = f"{context['tr']('error_title')} - {eklenti_adi}"
        context["description"] = context["tr"]("error_desc")
        return home_template.TemplateResponse(request=request, name="pages/error.html.j2", context=context)
