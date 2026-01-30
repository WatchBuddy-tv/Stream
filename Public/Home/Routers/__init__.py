# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi            import APIRouter, Request
from fastapi.templating import Jinja2Templates
from pathlib            import Path
from typing             import Optional
import json

home_router   = APIRouter(prefix="")
home_template = Jinja2Templates(directory="Public/Home/Templates")

_TRANSLATIONS    = {}
_SUPPORTED_LANGS = ("tr", "en")
_DEFAULT_LANG    = "tr"

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

def _normalize_lang(value: Optional[str]):
    if not value:
        return None
    lang = value.strip().lower().split("-")[0]
    return lang if lang in _SUPPORTED_LANGS else None

def detect_lang(request: Request) -> str:
    query_lang = _normalize_lang(request.query_params.get("lang"))
    if query_lang:
        return query_lang
    accept_lang = request.headers.get("accept-language", "")
    for part in accept_lang.split(","):
        code = _normalize_lang(part.split(";")[0])
        if code:
            return code
    return _DEFAULT_LANG

def build_context(request: Request, **extra):
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

    context = {
        "request"        : request,
        "lang"           : lang,
        "lang_query"     : f"?lang={lang}",
        "lang_query_amp" : f"&lang={lang}",
        "translations"   : translations,
        "translations_all": translations_all,
        "tr"             : tr,
        "site_name"      : tr("site_name"),
        "og_locale"      : "tr_TR" if lang == "tr" else "en_US"
    }
    context.update(extra)
    return context

from . import (
    ana_sayfa,
    seo,
    eklenti,
    kategori,
    icerik,
    ara,
    izle
)
