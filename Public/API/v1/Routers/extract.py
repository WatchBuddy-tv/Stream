# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core   import Request, JSONResponse
from .      import api_v1_router, api_v1_global_message
from ..Libs import extractor_manager
import asyncio, time

# Global safety guards
_extraction_semaphore = asyncio.Semaphore(10)
_inflight_extractions = {}  # URL -> Future
_negative_cache       = {}  # URL -> (timestamp, error_msg)
_NEG_CACHE_TTL        = 300  # 5 minutes

@api_v1_router.get("/extract")
async def extract(request:Request):
    istek = request.state.veri
    if not istek:
        return JSONResponse(status_code=410, content={"hata": f"{request.url.path}?_encoded_url=&_encoded_referer="})

    _encoded_url     = istek.get("encoded_url")
    _encoded_referer = istek.get("encoded_referer")
    if not _encoded_url:
        return JSONResponse(status_code=410, content={"hata": f"{request.url.path}?_encoded_url=&_encoded_referer="})

    # Doğrudan medya dosyaları için bypass (m3u8, mp4 vb.)
    url_lower = _encoded_url.lower()
    is_direct = any(ext in url_lower for ext in (".m3u8", ".mp4", ".mpd", ".webm", ".mkv", ".avi", ".mov", ".flv", ".wmv"))
    if is_direct:
        return {
            **api_v1_global_message,
            "result"        : {
                "name"          : "direct",
                "url"           : _encoded_url,
                "referer"       : _encoded_referer,
                "user_agent"    : request.headers.get("user-agent"),
                "extra_headers" : {},
                "subtitles"     : []
            }
        }

    # --- Safety 1: Negative Cache (Cache Miss Protection) ---
    now = time.time()
    if _encoded_url in _negative_cache:
        ts, err = _negative_cache[_encoded_url]
        if (now - ts) < _NEG_CACHE_TTL:
            return JSONResponse(status_code=503, content={"hata": f"URL is temporarily blocked due to previous failures: {err}"})
        else:
            _negative_cache.pop(_encoded_url)

    # --- Safety 2: Async Singleton Task (Deduplication) ---
    if _encoded_url in _inflight_extractions:
        return await _inflight_extractions[_encoded_url]

    async def _do_extract():
        extractor = extractor_manager.find_extractor(_encoded_url)
        if not extractor:
            _negative_cache[_encoded_url] = (time.time(), "Extractor not found")
            return JSONResponse(status_code=404, content={"hata": "Extractor bulunamadı."})

        async with _extraction_semaphore:
            try:
                # Add a reasonable timeout for the whole operation
                result = await asyncio.wait_for(
                    extractor.extract(_encoded_url, _encoded_referer),
                    timeout=15.0
                )
                return {**api_v1_global_message, "result": result}
            except asyncio.TimeoutError:
                _negative_cache[_encoded_url] = (time.time(), "Timeout")
                return JSONResponse(status_code=504, content={"hata": "Extraction timed out."})
            except Exception as e:
                _negative_cache[_encoded_url] = (time.time(), str(e))
                return JSONResponse(status_code=500, content={"hata": str(e)})

    # Create task and track it
    task = asyncio.create_task(_do_extract())
    _inflight_extractions[_encoded_url] = task

    try:
        return await task
    finally:
        _inflight_extractions.pop(_encoded_url, None)
