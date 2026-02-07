# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI import konsol
from .   import extractor_manager
import asyncio, subprocess, json, time, os

# Singleton YTDLP extractor instance
for extractor_cls in extractor_manager.extractors:
    instance = extractor_cls()
    if instance.name == "yt-dlp":
        _ytdlp_extractor = instance
        break

_CACHE: dict[str, dict] = {}
_CACHE_TS: dict[str, float] = {}
_NEG_CACHE_TS: dict[str, float] = {}
_CACHE_LOCK = asyncio.Lock()
_CACHE_TTL = int(os.getenv("YTDLP_CACHE_TTL", "600") or "600")
_NEG_TTL = int(os.getenv("YTDLP_NEG_TTL", "60") or "60")

async def ytdlp_extract_video_info(url: str, user_agent: str | None = None, referer: str | None = None):
    """
    yt-dlp ile video bilgisi çıkar

    YTDLP extractor'ın fast-path regex kontrolünü kullanarak
    önce URL'nin uygunluğunu kontrol eder, ardından bilgi çıkarır.

    Args:
        url: Video URL'si

    Returns:
        {
            "title": str,
            "stream_url": str,
            "duration": float,
            "thumbnail": str,
            "format": str  # "hls" | "mp4" | "webm"
        }
    """
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None

    # YTDLP extractor'ın optimize edilmiş can_handle_url kontrolü
    if not _ytdlp_extractor.can_handle_url(url):
        return None

    cache_key = f"{url}|{user_agent or ''}|{referer or ''}"
    now = time.time()
    async with _CACHE_LOCK:
        # Periyodik cache temizliği: expired girdileri sil (memory leak önleme)
        if len(_CACHE) > 200:
            expired = [k for k, ts in _CACHE_TS.items() if (now - ts) >= _CACHE_TTL]
            for k in expired:
                _CACHE.pop(k, None)
                _CACHE_TS.pop(k, None)
            neg_expired = [k for k, ts in _NEG_CACHE_TS.items() if (now - ts) >= _NEG_TTL]
            for k in neg_expired:
                _NEG_CACHE_TS.pop(k, None)

        ts = _CACHE_TS.get(cache_key)
        if ts and (now - ts) < _CACHE_TTL:
            return _CACHE.get(cache_key)
        neg_ts = _NEG_CACHE_TS.get(cache_key)
        if neg_ts and (now - neg_ts) < _NEG_TTL:
            return None

    # URL uygunsa tam bilgiyi çıkar
    info = await _extract_with_ytdlp(url, user_agent=user_agent, referer=referer)
    async with _CACHE_LOCK:
        if info:
            _CACHE[cache_key] = info
            _CACHE_TS[cache_key] = now
            _NEG_CACHE_TS.pop(cache_key, None)
        else:
            _NEG_CACHE_TS[cache_key] = now
    return info

async def _extract_with_ytdlp(url: str, user_agent: str | None = None, referer: str | None = None):
    """yt-dlp ile video bilgisi çıkar (internal)"""
    try:
        cmd = [
            "yt-dlp",
            "--no-warnings",
            "--no-playlist",
            "--socket-timeout", "10",
            "-j",  # JSON output
            "-f", "best/all",
            "--format-sort", "proto:https",  # HTTPS (progressive) öncelikli, HLS yerine
            url
        ]
        if user_agent:
            cmd.insert(-1, f"--user-agent={user_agent}")
        if referer:
            cmd.insert(-1, f"--referer={referer}")

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        timeout_s = float(os.getenv("YTDLP_TIMEOUT", "25") or "25")
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout_s
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            konsol.log(f"[red]yt-dlp error:[/] {error_msg}")
            return None

        # JSON parse
        info = json.loads(stdout.decode())

        # Format belirleme
        ext = info.get("ext", "mp4").lower()
        url_lower = info.get("url", "").lower()

        if "m3u8" in url_lower or info.get("protocol") == "m3u8_native":
            video_format = "hls"
        elif ext in ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv"]:
            video_format = ext
        else:
            video_format = "mp4"

        return {
            "title"        : info.get("title", "Video"),
            "stream_url"   : info.get("url"),
            "duration"     : info.get("duration", 0),
            "is_live"      : bool(info.get("is_live")) if info.get("is_live") is not None else False,
            "thumbnail"    : info.get("thumbnail"),
            "format"       : video_format,
            "uploader"     : info.get("uploader", ""),
            "description"  : info.get("description", "")[:200] if info.get("description") else "",
            "http_headers" : {k.lower(): v for k, v in info.get("http_headers", {}).items()}
        }

    except asyncio.TimeoutError:
        konsol.log(f"[red]yt-dlp timeout:[/] {url}")
        return None
    except json.JSONDecodeError as e:
        konsol.log(f"[red]yt-dlp JSON parse error:[/] {e}")
        return None
    except FileNotFoundError:
        konsol.log("[red]yt-dlp not found![/] Please install: pip install yt-dlp")
        return None
    except Exception as e:
        konsol.log(f"[red]yt-dlp exception:[/] {e}")
        return None
