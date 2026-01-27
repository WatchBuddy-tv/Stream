# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core import Request, Response
from .    import proxy_router
from urllib.parse import quote
import httpx

@proxy_router.get("/subtitle")
async def subtitle_proxy(request: Request, url: str, referer: str = None, user_agent: str = None):
    """
    Local origin proxy for subtitles to avoid CORS issues.
    Forwards request to the actual pyProxy service.
    """
    py_proxy_base = "https://pyProxy.watchbuddy.tv"

    params = []
    params.append(f"url={quote(url, safe='')}")
    if referer:
        params.append(f"referer={quote(referer, safe='')}")
    if user_agent:
        params.append(f"user_agent={quote(user_agent, safe='')}")

    target_url = f"{py_proxy_base}/proxy/subtitle?{'&'.join(params)}"

    async with httpx.AsyncClient(verify=False) as client:
        try:
            resp = await client.get(target_url, timeout=30.0)
            return Response(
                content     = resp.content,
                status_code = resp.status_code,
                headers     = {
                    "Content-Type"                : resp.headers.get("Content-Type", "text/vtt"),
                    "Access-Control-Allow-Origin" : "*",
                    "Cache-Control"               : "public, max-age=3600"
                }
            )
        except Exception as e:
            return Response(content=str(e), status_code=502)
