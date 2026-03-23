# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from httpx import AsyncClient

_ip_cache: dict[str, dict[str, str]] = {}

async def _ip_api_com(oturum: AsyncClient, hedef_ip: str) -> dict[str, str] | None:
    response = await oturum.get(f"http://ip-api.com/json/{hedef_ip}?fields=status,country,regionName,city,isp,org,as", timeout=5)
    veri = response.json()
    if veri.get("status") == "fail":
        return None
    return {
        "ulke"   : veri.get("country") or "",
        "il"     : veri.get("regionName") or "",
        "ilce"   : veri.get("city") or "",
        "isp"    : veri.get("isp") or "",
        "sirket" : veri.get("org") or "",
        "host"   : veri.get("as") or ""
    }

async def _ipapi_co(oturum: AsyncClient, hedef_ip: str) -> dict[str, str] | None:
    response = await oturum.get(f"https://ipapi.co/{hedef_ip}/json/", timeout=5)
    veri = response.json()
    if veri.get("error"):
        return None
    return {
        "ulke"   : veri.get("country_name") or "",
        "il"     : veri.get("region") or "",
        "ilce"   : veri.get("city") or "",
        "isp"    : veri.get("org") or "",
        "sirket" : veri.get("org") or "",
        "host"   : veri.get("asn") or ""
    }

async def _ipinfo_io(oturum: AsyncClient, hedef_ip: str) -> dict[str, str] | None:
    response = await oturum.get(f"https://ipinfo.io/{hedef_ip}/json", timeout=5)
    veri = response.json()
    if "bogon" in veri or not veri.get("country"):
        return None
    return {
        "ulke"   : veri.get("country") or "",
        "il"     : veri.get("region") or "",
        "ilce"   : veri.get("city") or "",
        "isp"    : veri.get("org") or "",
        "sirket" : veri.get("org") or "",
        "host"   : veri.get("org") or ""
    }

_PROVIDERS = [_ip_api_com, _ipapi_co, _ipinfo_io]

async def ip_log(hedef_ip: str) -> dict[str, str]:
    # Manuel cache - lru_cache async ile çalışmaz
    if hedef_ip in _ip_cache:
        return _ip_cache[hedef_ip]

    sonuc = {"hata": "Veri Bulunamadı.."}

    async with AsyncClient(follow_redirects=True) as oturum:
        for provider in _PROVIDERS:
            try:
                veri = await provider(oturum, hedef_ip)
                if veri:
                    sonuc = veri
                    break
            except Exception:
                continue

    # Cache'e ekle (max 128)
    if len(_ip_cache) >= 128:
        _ip_cache.pop(next(iter(_ip_cache)))
    _ip_cache[hedef_ip] = sonuc

    return sonuc
