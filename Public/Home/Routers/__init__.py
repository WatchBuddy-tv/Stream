# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi            import APIRouter
from fastapi.templating import Jinja2Templates

from ...API.v1.Libs         import plugin_manager
from ..Libs.provider_client import RemoteProviderClient
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
