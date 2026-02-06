# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, JSONResponse
from .    import api_v1_router, api_v1_global_message

from ..Libs.ytdlp_service import ytdlp_extract_video_info

@api_v1_router.get("/ytdlp-extract")
async def ytdlp_extract(request: Request):
    """
    yt-dlp ile video bilgisi çıkar.
    Go WebSocket servisi bu endpoint'i çağırarak video metadata alır.
    
    Query Parameters:
        url: Video URL'si
    
    Returns:
        {
            "title": str,
            "stream_url": str,
            "duration": float,
            "thumbnail": str,
            "format": str
        }
    """
    istek = request.state.veri
    if not istek:
        return JSONResponse(status_code=400, content={"hata": "url parametresi gerekli"})
    
    url = istek.get("url", "").strip()
    if not url:
        return JSONResponse(status_code=400, content={"hata": "url parametresi gerekli"})
    
    # yt-dlp ile video bilgisi çıkar
    info = await ytdlp_extract_video_info(
        url
    )
    
    if not info or not info.get("stream_url"):
        # yt-dlp bulamadıysa, orijinal URL'i kullan
        return {
            **api_v1_global_message,
            "result" : {
                "title"      : "Video",
                "stream_url" : url,
                "duration"   : 0,
                "is_live"    : False,
                "format"     : "hls" if ".m3u8" in url.lower() else "mp4",
                "resolved"   : False,
                "resolved_by": "fallback"
            }
        }
    
    return {
        **api_v1_global_message,
        "result" : {
            "title"      : info.get("title", "Video"),
            "stream_url" : info.get("stream_url"),
            "duration"   : info.get("duration", 0),
            "is_live"    : info.get("is_live", False),
            "thumbnail"  : info.get("thumbnail"),
            "format"     : info.get("format", "mp4"),
            "resolved"   : True,
            "resolved_by": "ytdlp"
        }
    }
