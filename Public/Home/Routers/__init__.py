# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi            import APIRouter
from fastapi.templating import Jinja2Templates

from ...API.v1.Libs         import fuck_dmca, get_client_headers
from ..Libs.provider_client import get_provider_client
from ..Libs.helpers         import build_context, detect_lang, detect_provider

home_router   = APIRouter(prefix="")
home_template = Jinja2Templates(directory="Public/Home/Templates")

from . import (
    ana_sayfa,
    seo,
    eklenti,
    kategori,
    icerik,
    ara,
    izle
)
