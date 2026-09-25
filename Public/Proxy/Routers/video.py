# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI                  import konsol
from fastapi              import Request, Response
from starlette.background import BackgroundTask
from fastapi.responses    import StreamingResponse
from .                    import proxy_router
from ..Libs.helpers       import prepare_request_headers, prepare_response_headers, detect_hls_from_url, stream_wrapper, rewrite_hls_manifest, is_hls_segment, shared_client, parse_extra_headers
from ..Libs.segment_cache import segment_cache

@proxy_router.get("/video")
@proxy_router.head("/video")
async def video_proxy(request: Request, url: str, referer: str = None, user_agent: str = None, force_proxy: str = None, title: str = None, subtitle_url: str = None, extra_headers: str = None):
    """Video proxy endpoint'i"""
    target_url           = url
    parsed_extra_headers = parse_extra_headers(extra_headers)
    request_headers      = prepare_request_headers(request, target_url, referer, user_agent, parsed_extra_headers)
    is_force_proxy       = force_proxy == "1"

    # HLS segment ise cache'i kontrol et
    if is_hls_segment(target_url):
        cached_content = await segment_cache.get(target_url)
        if cached_content:
            # konsol.print(f"[green]✓ Cache HIT:[/green] {target_url[-50:]}")
            return Response(
                content     = cached_content,
                status_code = 200,
                headers     = {
                    "Content-Type"                : "video/MP2T" if target_url.endswith('.ts') else "video/iso.segment",
                    "Cache-Control"               : "public, max-age=30",
                    "Access-Control-Allow-Origin" : "*",
                },
            )

    # Re-use global shared client
    client = shared_client

    try:
        # GET isteğini başlat
        req      = client.build_request("GET", target_url, headers=request_headers)
        response = await client.send(req, stream=True)

        if response.status_code >= 400:
            await response.aclose()
            return Response(status_code=response.status_code, content=f"Upstream Error: {response.status_code}")

        # 3. HLS Tespiti (URL + Header)
        is_hls       = detect_hls_from_url(target_url)
        content_type = response.headers.get("content-type", "").lower()
        if "mpegurl" in content_type or "m3u8" in content_type:
            is_hls = True


        detected_content_type = "application/vnd.apple.mpegurl" if is_hls else None

        # Response headerlarını hazırla
        final_headers = prepare_response_headers(dict(response.headers), target_url, detected_content_type)
        # HEAD isteği ise stream yapma, kapat ve dön
        if request.method == "HEAD":
            await response.aclose()
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

            # Manifest URL'lerini yeniden yaz
            rewritten_content = rewrite_hls_manifest(content, target_url, referer, user_agent, is_force_proxy, parsed_extra_headers)

            # Content-Length güncelle
            final_headers["Content-Length"] = str(len(rewritten_content))

            return Response(
                content     = rewritten_content,
                status_code = response.status_code,
                headers     = final_headers,
                media_type  = final_headers.get("Content-Type")
            )

        # HLS segment ise ve boyutu <= 5MB ise cache'e al, aksi halde stream et
        if is_hls_segment(target_url):
            content_length = int(response.headers.get("content-length", "0"))
            # Sadece bilinen ve makul boyutlu (<= 5MB) segmentleri belleğe al
            if 0 < content_length <= 5 * 1024 * 1024:
                content = await response.aread()
                await response.aclose()

                # Cache'e ekle
                await segment_cache.set(target_url, content)

                return Response(
                    content     = content,
                    status_code = response.status_code,
                    headers     = final_headers,
                    media_type  = final_headers.get("Content-Type")
                )

        # Normal video veya büyük/chunked segment - StreamingResponse döndür
        return StreamingResponse(
            stream_wrapper(response),
            status_code = response.status_code,
            headers     = final_headers,
            media_type  = final_headers.get("Content-Type"),
            background  = BackgroundTask(response.aclose)
        )

    except Exception as e:
        konsol.print(f"[red]Proxy başlatma hatası: {str(e)}[/red]")
        return Response(status_code=502, content=f"Proxy Error: {str(e)}")
