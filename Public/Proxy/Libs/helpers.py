# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI          import konsol
from fastapi      import Request
from urllib.parse import unquote, urljoin, quote
import httpx, traceback, re

DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5)"
DEFAULT_REFERER    = "https://twitter.com/"
DEFAULT_CHUNK_SIZE = 1024 * 128  # 128KB

CONTENT_TYPES = {
    ".m3u8" : "application/vnd.apple.mpegurl",
    ".ts"   : "video/mp2t",
    ".mp4"  : "video/mp4",
    ".webm" : "video/webm",
    ".mkv"  : "video/x-matroska",
    ".avi"  : "video/x-msvideo",
    ".mov"  : "video/quicktime",
    ".flv"  : "video/x-flv",
    ".wmv"  : "video/x-ms-wmv",
    ".m4s"  : "video/iso.segment",
}

CORS_HEADERS = {
    "Access-Control-Allow-Origin"  : "*",
    "Access-Control-Allow-Methods" : "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers" : "Origin, Content-Type, Accept, Range",
    "Access-Control-Expose-Headers": "X-Resolved-Url, X-Resolved-User-Agent, X-Resolved-Referer, X-Resolved-Title, X-Resolved-Format, X-Resolved-Duration, X-Resolved-Is-Live",
}

def detect_hls_live(content: bytes) -> tuple[bool, bool]:
    """Return (is_live, has_signal). VOD-safe: only strong LIVE signals mark live."""
    try:
        text = content.decode("utf-8", errors="ignore").strip()
    except Exception:
        return (False, False)
    if not text.startswith("#EXTM3U"):
        return (False, False)
    upper = text.upper()
    if "#EXT-X-ENDLIST" in upper or "#EXT-X-PLAYLIST-TYPE:VOD" in upper:
        return (False, True)
    if "#EXT-X-PLAYLIST-TYPE:EVENT" in upper or "#EXT-X-PLAYLIST-TYPE:LIVE" in upper:
        return (True, True)
    if "#EXT-X-PROGRAM-DATE-TIME" in upper:
        return (True, True)
    if "#EXT-X-SERVER-CONTROL" in upper or "#EXT-X-PART" in upper or "#EXT-X-SKIP" in upper:
        return (True, True)
    if "#EXT-X-MEDIA-SEQUENCE" in upper:
        return (True, True)

    # Heuristic: short rolling playlist without ENDLIST
    lines = text.splitlines()
    segment_count = 0
    total_duration = 0.0
    target_duration = 0.0
    for line in lines:
        line = line.strip()
        if line.startswith("#EXT-X-TARGETDURATION:"):
            try:
                target_duration = float(line.split(":", 1)[1].strip())
            except Exception:
                pass
        if line.startswith("#EXTINF:"):
            try:
                val = line.split(":", 1)[1]
                if "," in val:
                    val = val.split(",", 1)[0]
                total_duration += float(val.strip())
                segment_count += 1
            except Exception:
                pass

    if target_duration > 0 and segment_count > 0:
        if segment_count <= 6 and total_duration <= (target_duration * 6 + 0.5):
            return (True, True)

    return (False, False)

def is_hls_master(content: bytes) -> bool:
    try:
        text = content.decode("utf-8", errors="ignore").strip()
    except Exception:
        return False
    if not text.startswith("#EXTM3U"):
        return False
    return "#EXT-X-STREAM-INF" in text.upper()

def extract_first_variant_url(base_url: str, content: bytes) -> str | None:
    try:
        text = content.decode("utf-8", errors="ignore").strip()
    except Exception:
        return None
    if not text.startswith("#EXTM3U"):
        return None
    lines = text.splitlines()
    expect_url = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXT-X-STREAM-INF"):
            expect_url = True
            continue
        if line.startswith("#"):
            continue
        if expect_url:
            return urljoin(base_url, line)
    return None

def get_content_type(url: str, response_headers: dict) -> str:
    """URL ve response headers'dan content-type belirle"""
    # 1. Response header kontrolü
    if ct := response_headers.get("content-type"):
        return ct
    
    # 2. URL uzantısı kontrolü
    url_lower = url.lower()
    for ext, ct in CONTENT_TYPES.items():
        if ext in url_lower:
            return ct
            
    # 3. Varsayılan
    return "video/mp4"

def prepare_request_headers(request: Request, url: str, referer: str | None, user_agent: str | None) -> dict:
    """Proxy isteği için headerları hazırlar"""
    headers = {}

    # Standart headerlar (Eğer extra_headers'da yoksa ekle)
    if "Accept" not in headers:
        headers["Accept"] = "*/*"
    if "Accept-Encoding" not in headers:
        headers["Accept-Encoding"] = "identity"
    if "Connection" not in headers:
        headers["Connection"] = "keep-alive"

    # user-agent ayarı
    if user_agent and user_agent != "None":
        headers["user-agent"] = user_agent
    elif "user-agent" not in headers:
        headers["user-agent"] = DEFAULT_USER_AGENT

    if referer and referer != "None":
        headers["referer"] = unquote(referer)

    return headers

def prepare_response_headers(response_headers: dict, url: str, detected_content_type: str = None) -> dict:
    """Client'a dönecek headerları hazırlar"""
    headers = CORS_HEADERS.copy()

    # Content-Type belirle
    headers["Content-Type"] = detected_content_type or get_content_type(url, response_headers)

    # Transfer edilecek headerlar
    important_headers = [
        "content-range", "accept-ranges",
        "etag", "cache-control", "content-disposition",
        "content-length"
    ]

    for header in important_headers:
        if val := response_headers.get(header):
            headers[header.title()] = val

    # Zorunlu headerlar
    if "Accept-Ranges" not in headers:
        headers["Accept-Ranges"] = "bytes"

    return headers

def detect_hls_from_url(url: str) -> bool:
    """URL yapısından HLS olup olmadığını tahmin eder"""
    indicators = (".m3u8", "/m.php", "/l.php", "/ld.php", "master.txt", "embed/sheila")
    return any(x in url for x in indicators)

def is_hls_segment(url: str) -> bool:
    """URL'nin HLS segment'i olup olmadığını kontrol et"""
    url_lower = url.lower()

    # Manifest'leri hariç tut
    if ".m3u8" in url_lower:
        return False

    # Segment göstergeleri
    segment_indicators = (".ts", ".m4s", ".mp4", ".aac", "seg-", "chunk-", "fragment", ".png", ".jpg", ".jpeg")
    return any(indicator in url_lower for indicator in segment_indicators)

def rewrite_hls_manifest(content: bytes, base_url: str, referer: str = None, user_agent: str = None, force_proxy: bool = False) -> bytes:
    """
    HLS manifest içindeki göreceli URL'leri işler.
    
    BANT GENİŞLİĞİ OPTİMİZASYONU:
    - Manifest dosyaları (.m3u8) -> Proxy üzerinden (CORS + header injection için)
    - Video segmentleri (.ts, .m4s) -> Doğrudan CDN'den (bant genişliği tasarrufu)
    """
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        return content  # Binary içerik, değiştirme

    # HLS manifest değilse değiştirme
    if not text.strip().startswith('#EXTM3U'):
        return content

    lines = text.split('\n')
    new_lines = []

    for line in lines:
        stripped = line.strip()

        # URI="..." içeren satırları işle (audio/subtitle tracks, encryption keys)
        if 'URI="' in line:
            def replace_uri(match):
                uri = match.group(1)
                absolute_url = urljoin(base_url, uri)
                
                # Eğer bir segment DEĞİLSE (key veya alt manifest ise) proxy üzerinden geçmeli
                # VEYA force_proxy aktif ise her şey proxy üzerinden geçmeli
                if force_proxy or not is_hls_segment(absolute_url):
                    proxy_url = f'/proxy/video?url={quote(absolute_url, safe="")}'
                    if referer:
                        proxy_url += f'&referer={quote(referer, safe="")}'
                    if user_agent:
                        proxy_url += f'&user_agent={quote(user_agent, safe="")}'
                    if force_proxy:
                        proxy_url += '&force_proxy=1'
                    return f'URI="{proxy_url}"'
                
                # Segment ise doğrudan CDN
                return f'URI="{absolute_url}"'

            line = re.sub(r'URI="([^"]+)"', replace_uri, line)
            new_lines.append(line)

        # URL satırları (# ile başlamayan ve boş olmayan)
        elif stripped and not stripped.startswith('#'):
            absolute_url = urljoin(base_url, stripped)
            
            # Segment ise doğrudan CDN (Bant Genişliği Tasarrufu)
            if not force_proxy and is_hls_segment(absolute_url):
                new_lines.append(absolute_url)
            else:
                # Alt manifest (.m3u8) veya force_proxy=true ise proxy
                proxy_url = f'/proxy/video?url={quote(absolute_url, safe="")}'
                if referer:
                    proxy_url += f'&referer={quote(referer, safe="")}'
                if user_agent:
                    proxy_url += f'&user_agent={quote(user_agent, safe="")}'
                if force_proxy:
                    proxy_url += '&force_proxy=1'
                new_lines.append(proxy_url)

        else:
            new_lines.append(line)

    return '\n'.join(new_lines).encode('utf-8')

async def stream_wrapper(response: httpx.Response):
    """Response içeriğini yield eder ve HLS kontrolü yapar"""
    try:
        original_ct  = response.headers.get('content-type', 'bilinmiyor')
        first_chunk  = None
        corrected_ct = None

        async for chunk in response.aiter_bytes(chunk_size=DEFAULT_CHUNK_SIZE):
            if first_chunk is None:
                first_chunk = chunk
                # HLS Manifest kontrolü
                try:
                    preview = chunk[:100].decode('utf-8', errors='ignore')
                    if preview.strip().startswith('#EXTM3U'):
                        corrected_ct = 'application/vnd.apple.mpegurl'
                except:
                    pass

                # # HTML uyarısı
                # if 'text/html' in original_ct.lower() and not corrected_ct:
                #     konsol.print(f"[red]⚠️  UYARI: Kaynak HTML döndürüyor![/red]")

            yield chunk
            
    except GeneratorExit:
        pass
    except Exception as e:
        konsol.print(f"[red]Stream hatası: {str(e)}[/red]")
        konsol.print(traceback.format_exc())
    except BaseException:
        pass
    finally:
        await response.aclose()

def process_subtitle_content(content: bytes, content_type: str, url: str) -> bytes:
    """Altyazı içeriğini işler ve VTT formatına çevirir"""
    # 1. UTF-8 BOM temizliği
    if content.startswith(b"\xef\xbb\xbf"):
        content = content[3:]

    # 2. VTT Kontrolü
    is_vtt = "text/vtt" in content_type or content.startswith(b"WEBVTT")
    if is_vtt:
        if not content.startswith(b"WEBVTT"):
            return b"WEBVTT\n\n" + content
        return content

    # 3. SRT -> VTT Dönüşümü
    is_srt = (
        content_type == "application/x-subrip" or 
        url.endswith(".srt") or 
        content.strip().startswith(b"1\r\n") or 
        content.strip().startswith(b"1\n")
    )

    if is_srt:
        try:
            content = content.replace(b"\r\n", b"\n")
            content = content.replace(b",", b".") # Zaman formatı düzeltmesi
            if not content.startswith(b"WEBVTT"):
                content = b"WEBVTT\n\n" + content
            return content
        except Exception as e:
            konsol.print(f"[yellow]SRT dönüştürme hatası: {str(e)}[/yellow]")

    return content
