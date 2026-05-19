# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core     import kekik_FastAPI, Request, Response
from ._IP_Log import ip_log

# ! ----------------------------------------» Güvenlik Listeleri
_BLOCKED_IPS  = []
_BLOCKED_ISPS = ["contabo", "digitalocean", "hetzner", "ovh", "linode", "amazon", "facebook", "google", "azure", "vultr", "choopa", "m247", "data", "alexhost"]

@kekik_FastAPI.middleware("http")
async def guvenlik_duvari(request: Request, call_next):
    # ! 1. IP Tespiti (Cloudflare ve Proxy Desteği ile)
    fw_for    = request.headers.get("X-Forwarded-For")
    cf_ip     = request.headers.get("Cf-Connecting-Ip")
    client_ip = cf_ip or (fw_for.split(",")[0].strip() if fw_for else request.client.host)

    # ! 2. Manuel IP Engelleme
    if client_ip in _BLOCKED_IPS:
        return Response(status_code=403)

    # ! 3. ISP / Veri Merkezi Bloklama
    ip_detay               = await ip_log(client_ip)
    request.state.ip_detay = ip_detay  # _istek.py loglaması için sakla

    # Tüm değerleri birleştirip küçük harfe çevirerek kontrol et
    isp_bilgisi = " ".join(str(v) for v in ip_detay.values()).lower()

    if any(sirket in isp_bilgisi for sirket in _BLOCKED_ISPS):
        return Response(status_code=403)

    return await call_next(request)
