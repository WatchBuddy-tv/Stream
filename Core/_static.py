# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

"""
Sadece derlenmiş (.min.css / .min.js) asset'leri ve ikili varlıkları servis eder.
Ham .css / .js / .map kaynakları 404 döner — minify + obfuscate emeğini boşa
çıkarmasın ve source yorumları (dev notları, endpoint ipuçları) sızmasın.
"""

from starlette.staticfiles import StaticFiles
from starlette.responses   import PlainTextResponse, Response
from starlette.types       import Scope


def _is_source_asset(path: str) -> bool:
    p = path.lower()
    if p.endswith((".min.css", ".min.js")):
        return False
    return p.endswith((".css", ".js", ".map"))


class BuiltOnlyStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        if _is_source_asset(path):
            return PlainTextResponse("Not Found", status_code=404)
        return await super().get_response(path, scope)
