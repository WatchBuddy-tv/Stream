# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi            import APIRouter
from fastapi.templating import Jinja2Templates

from ...API.v1.Libs         import fuck_dmca, get_client_headers
from ..Libs.provider_client import get_provider_client
from ..Libs.helpers         import build_context, detect_lang, detect_provider, resolve_asset_version

home_router   = APIRouter(prefix="")
home_template = Jinja2Templates(directory="Public/Home/Templates")
home_template.env.globals["asset_version"] = lambda: resolve_asset_version("Public/Home/Static/JS/main.min.js", "Public/Home/Static/CSS/style.bundle.min.css")

from . import ana_sayfa, seo, eklenti, kategori, icerik, ara, izle
