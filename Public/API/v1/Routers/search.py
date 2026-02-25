# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request, JSONResponse
from .      import api_v1_router, api_v1_global_message
from ..Libs import plugin_manager

from random       import choice
from urllib.parse import quote_plus
import re
import unicodedata

_TR_CHAR_MAP = str.maketrans({
    "ı" : "i",
    "İ" : "i",
    "ş" : "s",
    "Ş" : "s",
    "ğ" : "g",
    "Ğ" : "g",
    "ü" : "u",
    "Ü" : "u",
    "ö" : "o",
    "Ö" : "o",
    "ç" : "c",
    "Ç" : "c",
})

def _normalize_text(value: str) -> str:
    if not value:
        return ""
    text = str(value).translate(_TR_CHAR_MAP)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold()
    return re.sub(r"\s+", " ", text).strip()

def _tokenize(value: str) -> list[str]:
    return [token for token in re.split(r"[^a-z0-9]+", value) if token]

def _extract_title(item) -> str:
    if isinstance(item, dict):
        return str(item.get("title") or item.get("name") or "")
    return str(getattr(item, "title", "") or getattr(item, "name", ""))

def _similarity_score(title: str, query: str) -> int:
    t = _normalize_text(title)
    q = _normalize_text(query)
    if not t or not q:
        return 0

    if t == q:
        return 1000

    score = 0

    if t.startswith(q):
        score = max(score, 850 - min(200, len(t) - len(q)))

    idx = t.find(q)
    if idx != -1:
        score = max(score, 700 - min(250, idx * 4) - min(100, max(0, len(t) - len(q))))

    q_tokens = _tokenize(q)
    t_tokens = _tokenize(t)
    if q_tokens and t_tokens:
        common         = sum(1 for token in q_tokens if token in t_tokens)
        coverage_score = int((common / len(q_tokens)) * 520)
        if t.startswith(q_tokens[0]):
            coverage_score += 80
        score = max(score, coverage_score)

    return score

@api_v1_router.get("/search")
async def search(request:Request):
    istek        = request.state.veri
    plugin_names = plugin_manager.get_plugin_names()
    if not istek:
        return JSONResponse(status_code=410, content={"hata": f"{request.url.path}?plugin={choice(plugin_names)}&query="})

    _plugin = istek.get("plugin")
    _plugin = _plugin if _plugin in plugin_names else None
    _query  = istek.get("query")
    if not _plugin or not _query:
        return JSONResponse(status_code=410, content={"hata": f"{request.url.path}?plugin={_plugin or choice(plugin_names)}&query="})

    plugin = plugin_manager.select_plugin(_plugin)
    result = await plugin.search(_query)
    result = sorted(
        result,
        key=lambda item: (
            -_similarity_score(_extract_title(item), _query),
            _normalize_text(_extract_title(item))
        )
    )

    for elem in result:
        if isinstance(elem, dict):
            elem["url"] = quote_plus(str(elem.get("url", "")))
        else:
            elem.url = quote_plus(elem.url)

    return {**api_v1_global_message, "result": result}
