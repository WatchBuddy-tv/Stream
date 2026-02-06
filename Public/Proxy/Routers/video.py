# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI                  import konsol
from fastapi              import Request, Response
from starlette.background import BackgroundTask
from fastapi.responses    import StreamingResponse
from .                    import proxy_router
from ..Libs.helpers       import prepare_request_headers, prepare_response_headers, detect_hls_from_url, stream_wrapper, rewrite_hls_manifest, is_hls_segment, detect_hls_live, is_hls_master, extract_first_variant_url
from ..Libs.segment_cache import segment_cache
from Public.API.v1.Libs.ytdlp_service import ytdlp_extract_video_info
from urllib.parse         import unquote, quote
import httpx

def _is_direct_media_url(url: str) -> bool:
    url_lower = url.lower()
    if ".m3u8" in url_lower:
        return True
    direct_exts = (".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".ts", ".m4s")
    return any(ext in url_lower for ext in direct_exts)

def _should_resolve_url(url: str) -> bool:
    if is_hls_segment(url):
        return False
    if detect_hls_from_url(url):
        return False
    if _is_direct_media_url(url):
        return False
    return True

async def _resolve_with_ytdlp(decoded_url: str, referer: str | None, user_agent: str | None):
    info = await ytdlp_extract_video_info(decoded_url, user_agent=user_agent, referer=referer)
    if not info or not info.get("stream_url"):
        return None
    headers = info.get("http_headers", {}) or {}
    return {
        "title"      : info.get("title", "Video"),
        "stream_url" : info.get("stream_url"),
        "duration"   : info.get("duration", 0),
        "is_live"    : info.get("is_live", False),
        "format"     : info.get("format", "mp4"),
        "user_agent" : headers.get("user-agent", ""),
        "referer"    : headers.get("referer", ""),
        "resolved"   : True,
        "resolved_by": "ytdlp"
    }

@proxy_router.get("/video")
@proxy_router.head("/video")
async def video_proxy(request: Request, url: str, referer: str = None, user_agent: str = None, force_proxy: str = None, title: str = None, subtitle_url: str = None):
    """Video proxy endpoint'i"""
    decoded_url     = unquote(url)
    original_url    = decoded_url
    request_headers = prepare_request_headers(request, decoded_url, referer, user_agent)
    is_force_proxy  = force_proxy == "1"

    # If user provided metadata, keep it as the source of truth
    if title:
        request.state.resolved_title = quote(str(title), safe="")
    if subtitle_url:
        request.state.resolved_subtitle = quote(str(subtitle_url), safe="")
    if user_agent:
        request.state.resolved_user_agent = str(user_agent)
    if referer:
        request.state.resolved_referer = str(referer)

    if _should_resolve_url(decoded_url):
        try:
            result = await _resolve_with_ytdlp(decoded_url, referer, user_agent)
        except Exception:
            result = None
        if result and result.get("stream_url"):
            decoded_url = result["stream_url"]
            request.state.resolved_url = decoded_url
            if result.get("user_agent") and not user_agent:
                request.state.resolved_user_agent = result.get("user_agent")
            if result.get("referer") and not referer:
                request.state.resolved_referer = result.get("referer")
            elif not referer:
                request.state.resolved_referer = original_url
            if result.get("title") and not title:
                request.state.resolved_title = quote(str(result.get("title")), safe="")
            if result.get("format"):
                request.state.resolved_format = result.get("format")
            if result.get("duration") is not None:
                request.state.resolved_duration = result.get("duration")
            if result.get("is_live") is not None:
                request.state.resolved_is_live = bool(result.get("is_live"))
            if result.get("resolved_by"):
                request.state.resolved_by = result.get("resolved_by")
            if result.get("resolved") is not None:
                request.state.resolved_flag = bool(result.get("resolved"))
            if not user_agent and result.get("user_agent"):
                user_agent = result.get("user_agent")
            if not referer and result.get("referer"):
                referer = result.get("referer")
            if not referer:
                referer = original_url
            request_headers = prepare_request_headers(request, decoded_url, referer, user_agent)

    # HLS segment ise cache'i kontrol et
    if is_hls_segment(decoded_url):
        cached_content = await segment_cache.get(decoded_url)
        if cached_content:
            # konsol.print(f"[green]✓ Cache HIT:[/green] {decoded_url[-50:]}")
            return Response(
                content     = cached_content,
                status_code = 200,
                headers     = {
                    "Content-Type"                : "video/MP2T" if decoded_url.endswith('.ts') else "video/iso.segment",
                    "Cache-Control"               : "public, max-age=30",
                    "Access-Control-Allow-Origin" : "*",
                },
            )

    # Client oluştur (SSL doğrulaması devre dışı - bazı sunucular self-signed sertifika kullanıyor)
    client = httpx.AsyncClient(
        follow_redirects = True,
        timeout          = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0),
        verify           = False,
    )

    try:
        # GET isteğini başlat
        req = client.build_request("GET", decoded_url, headers=request_headers)
        response = await client.send(req, stream=True)

        if response.status_code >= 400:
            await response.aclose()
            await client.aclose()
            return Response(status_code=response.status_code, content=f"Upstream Error: {response.status_code}")

        # 3. HLS Tespiti (URL + Header)
        is_hls = detect_hls_from_url(decoded_url)
        content_type = response.headers.get("content-type", "").lower()
        if "mpegurl" in content_type or "m3u8" in content_type:
            is_hls = True

        detected_content_type = "application/vnd.apple.mpegurl" if is_hls else None

        # Response headerlarını hazırla
        final_headers = prepare_response_headers(dict(response.headers), decoded_url, detected_content_type)
        resolved_url = getattr(request.state, "resolved_url", None)
        if resolved_url and resolved_url != original_url:
            final_headers["X-Resolved-Url"] = resolved_url
        resolved_ua = getattr(request.state, "resolved_user_agent", None)
        if resolved_ua:
            final_headers["X-Resolved-User-Agent"] = resolved_ua
        resolved_ref = getattr(request.state, "resolved_referer", None)
        if resolved_ref:
            final_headers["X-Resolved-Referer"] = resolved_ref
        resolved_title = getattr(request.state, "resolved_title", None)
        if resolved_title:
            final_headers["X-Resolved-Title"] = str(resolved_title)
        resolved_subtitle = getattr(request.state, "resolved_subtitle", None)
        if resolved_subtitle:
            final_headers["X-Resolved-Subtitle"] = str(resolved_subtitle)
        resolved_format = getattr(request.state, "resolved_format", None)
        if resolved_format:
            final_headers["X-Resolved-Format"] = str(resolved_format)
        resolved_duration = getattr(request.state, "resolved_duration", None)
        if resolved_duration is not None:
            final_headers["X-Resolved-Duration"] = str(resolved_duration)
        resolved_is_live = getattr(request.state, "resolved_is_live", None)
        if resolved_is_live is not None:
            final_headers["X-Resolved-Is-Live"] = "true" if resolved_is_live else "false"
        resolved_by = getattr(request.state, "resolved_by", None)
        if resolved_by:
            final_headers["X-Resolved-By"] = str(resolved_by)
        resolved_flag = getattr(request.state, "resolved_flag", None)
        if resolved_flag is not None:
            final_headers["X-Resolved"] = "true" if resolved_flag else "false"

        async def _detect_live_with_variant(content: bytes):
            is_live, has_signal = detect_hls_live(content)
            if has_signal:
                return is_live, True
            if is_hls_master(content):
                variant_url = extract_first_variant_url(decoded_url, content)
                if variant_url:
                    try:
                        vreq = client.build_request("GET", variant_url, headers=request_headers)
                        vresp = await client.send(vreq, stream=True)
                        if vresp.status_code < 400:
                            vcontent = await vresp.aread()
                            await vresp.aclose()
                            return detect_hls_live(vcontent)
                        await vresp.aclose()
                    except Exception:
                        return False, False
            return False, False

        # HEAD isteği ise stream yapma, kapat ve dön
        if request.method == "HEAD":
            if is_hls:
                content = await response.aread()
                is_live, has_signal = await _detect_live_with_variant(content)
                if has_signal:
                    final_headers["X-Resolved-Is-Live"] = "true" if is_live else "false"
                elif "X-Resolved-Is-Live" not in final_headers:
                    final_headers["X-Resolved-Is-Live"] = "false"
            elif "X-Resolved-Is-Live" not in final_headers:
                final_headers["X-Resolved-Is-Live"] = "false"
            await response.aclose()
            await client.aclose()
            return Response(
                content     = b"",
                status_code = response.status_code,
                headers     = final_headers,
                media_type  = final_headers.get("Content-Type")
            )

        # HLS manifest ise içeriği yeniden yaz
        if is_hls:
            # Tüm içeriği oku
            content = await response.aread()
            await response.aclose()
            await client.aclose()

            is_live, has_signal = await _detect_live_with_variant(content)
            if has_signal:
                final_headers["X-Resolved-Is-Live"] = "true" if is_live else "false"
            elif "X-Resolved-Is-Live" not in final_headers:
                final_headers["X-Resolved-Is-Live"] = "false"

            # Manifest URL'lerini yeniden yaz
            rewritten_content = rewrite_hls_manifest(content, decoded_url, referer, user_agent, is_force_proxy)

            # Content-Length güncelle
            final_headers["Content-Length"] = str(len(rewritten_content))

            return Response(
                content     = rewritten_content,
                status_code = response.status_code,
                headers     = final_headers,
                media_type  = final_headers.get("Content-Type")
            )

        # HLS segment ise cache'e al
        if is_hls_segment(decoded_url):
            content = await response.aread()
            await response.aclose()
            await client.aclose()

            # Cache'e ekle
            await segment_cache.set(decoded_url, content)
            # konsol.print(f"[yellow]⚡ Cache MISS:[/yellow] {decoded_url[-50:]} ({len(content) // 1024}KB)")

            return Response(
                content     = content,
                status_code = response.status_code,
                headers     = final_headers,
                media_type  = final_headers.get("Content-Type")
            )

        # Normal video - StreamingResponse döndür
        if "X-Resolved-Is-Live" not in final_headers:
            final_headers["X-Resolved-Is-Live"] = "false"
        return StreamingResponse(
            stream_wrapper(response),
            status_code = response.status_code,
            headers     = final_headers,
            media_type  = final_headers.get("Content-Type"),
            background  = BackgroundTask(client.aclose)
        )

    except Exception as e:
        await client.aclose()
        konsol.print(f"[red]Proxy başlatma hatası: {str(e)}[/red]")
        return Response(status_code=502, content=f"Proxy Error: {str(e)}")
