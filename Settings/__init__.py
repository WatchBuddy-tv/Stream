# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from pathlib import Path
from yaml    import load, FullLoader
from dotenv  import load_dotenv
import os

# .env yükleme
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# AYAR.yml yükleme
with open("AYAR.yml", "r", encoding="utf-8") as yaml_dosyasi:
    AYAR = load(yaml_dosyasi, Loader=FullLoader)

# Genel ayarlar
PROJE = AYAR["PROJE"]
HOST  = AYAR["APP"]["HOST"]
PORT  = AYAR["APP"]["PORT"]

# Provider Metadata
def _clean_url(value: str) -> str:
    cleaned = (value or "").strip()
    return cleaned.rstrip("/") if cleaned else ""

PROVIDER_NAME        = os.getenv("PROVIDER_NAME", PROJE)
PROVIDER_DESCRIPTION = os.getenv("PROVIDER_DESCRIPTION", "KekikStream Content Provider")
PROXY_URL            = _clean_url(os.getenv("PROXY_URL", ""))
PROXY_FALLBACK_URL   = _clean_url(os.getenv("PROXY_FALLBACK_URL", ""))

# Proxy ayarları (Outgoing)
http_proxy  = os.getenv("HTTP_PROXY", None)
https_proxy = os.getenv("HTTPS_PROXY", None)

# Check if proxy values are actually valid URLs (not "none" or empty)
def _is_valid_proxy(value: str | None) -> bool:
    if not value:
        return False
    cleaned = value.strip().lower()
    return cleaned not in ("none", "") and (cleaned.startswith("http://") or cleaned.startswith("https://"))

if _is_valid_proxy(http_proxy) and _is_valid_proxy(https_proxy):
    PROXIES = {
        "http"  : http_proxy,
        "https" : https_proxy,
    }
else:
    PROXIES = None
