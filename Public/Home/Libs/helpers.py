# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import json
from pathlib      import Path
from typing       import Optional, Any
from fastapi      import Request
from urllib.parse import quote, unquote

from .provider_client import RemoteProviderClient

_TRANSLATIONS    = {}
_SUPPORTED_LANGS = ("tr", "en")
_DEFAULT_LANG    = "en"

def _load_translations():
    global _TRANSLATIONS
    if _TRANSLATIONS:
        return _TRANSLATIONS
    translations_dir = Path(__file__).resolve().parents[1] / "Translations"
    for lang in _SUPPORTED_LANGS:
        path = translations_dir / f"{lang}.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _TRANSLATIONS[lang] = json.load(f)
        else:
            _TRANSLATIONS[lang] = {}
    return _TRANSLATIONS

def _normalize_lang(value: str | None) -> str | None:
    if not value:
        return None
    lang = value.strip().lower().split("-")[0]
    return lang if lang in _SUPPORTED_LANGS else None

def detect_lang(request: Request) -> str:
    # 1. Query param en yüksek öncelik (?lang=en)
    query_lang = _normalize_lang(request.query_params.get("lang"))
    if query_lang:
        return query_lang

    # 2. Cookie'den oku (kullanıcının kaydettiği tercih)
    cookie_lang = _normalize_lang(request.cookies.get("lang"))
    if cookie_lang:
        return cookie_lang

    # 3. Accept-Language header'dan oku (tarayıcı tercihi)
    accept_lang = request.headers.get("accept-language", "")
    for part in accept_lang.split(","):
        code = _normalize_lang(part.split(";")[0])
        if code:
            return code

    # 4. Default dil
    return _DEFAULT_LANG

def detect_provider(request: Request) -> Optional[str]:
    # Query param öncelikli (yeni provider seçimi için)
    provider = request.query_params.get("provider")
    if provider:
        # Decode et ve protokol kontrolü yap
        _url = unquote(provider.strip()).rstrip("/")
        if _url and not _url.startswith(("http://", "https://")):
            _url = f"https://{_url}"
        return _url

    # Yoksa cookie'den oku (kalıcı seçim - zaten decoded)
    cookie_provider = request.cookies.get("provider_url")
    if cookie_provider:
        _url = cookie_provider.strip().rstrip("/")
        if _url and not _url.startswith(("http://", "https://")):
            _url = f"https://{_url}"
        return _url

    return None

async def build_context(request: Request, **extra):
    lang = detect_lang(request)
    translations_all = _load_translations()
    translations = translations_all.get(lang, {})

    def tr(key: str, **kwargs):
        value = translations.get(key, key)
        if kwargs:
            try:
                return value.format(**kwargs)
            except KeyError:
                return value
        return value

    provider_url  = detect_provider(request)
    provider_name = None

    # Remote provider ise schema'dan provider_name çek
    if provider_url:
        try:
            async with RemoteProviderClient(provider_url) as client:
                provider_name = await client.get_provider_name()
        except:
            # Schema çekilemezse default kullan
            provider_name = "Remote Provider"
    else:
        # Local provider için Settings'ten al
        from Settings import PROVIDER_NAME
        provider_name = PROVIDER_NAME

    # Provider URL parametreleri (template linkleri için)
    # NOT: quote_plus yerine quote kullan (+ işaretinden kaçınmak için)
    if provider_url:
        # URL-safe encoding (RFC 3986 safe chars: -_.~)
        encoded_provider   = quote(provider_url, safe='')
        provider_query     = f"?provider={encoded_provider}"
        provider_query_amp = f"&provider={encoded_provider}"
    else:
        provider_query     = ""
        provider_query_amp = ""

    context = {
        "request"            : request,
        "lang"               : lang,
        "provider_query"     : provider_query,
        "provider_query_amp" : provider_query_amp,
        "translations"       : translations,
        "translations_all"   : translations_all,
        "tr"                 : tr,
        "site_name"          : tr("site_name"),
        "og_locale"          : "tr_TR" if lang == "tr" else "en_US",
        "provider_url"       : provider_url,
        "provider_name"      : provider_name,
        "is_remote"          : bool(provider_url)
    }
    context.update(extra)
    return context
