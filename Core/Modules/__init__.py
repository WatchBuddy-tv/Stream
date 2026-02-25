# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from fastapi    import FastAPI
from contextlib import asynccontextmanager
from CLI        import konsol
from contextlib import suppress
import asyncio

_availability_checked = False
_availability_lock    = asyncio.Lock()

async def _check_plugin(name: str, plugin, sem: asyncio.Semaphore) -> tuple[str, bool, int | None]:
    if not getattr(plugin, "main_url", None):
        return name, False, None

    async with sem:
        try:
            istek = await plugin.httpx.get(plugin.main_url)
            return name, istek.status_code == 200, istek.status_code
        except Exception:
            return name, False, None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan events - startup ve shutdown"""
    global _availability_checked

    async with _availability_lock:
        if not _availability_checked:
            try:
                from Public.API.v1.Libs import plugin_manager

                plugin_items = list(plugin_manager.plugins.items())
                sem          = asyncio.Semaphore(10)
                checks       = [_check_plugin(name, plugin, sem) for name, plugin in plugin_items]
                results      = await asyncio.gather(*checks)

                removed_count = 0
                for name, is_available, status_code in results:
                    if name in ["RecTV"]:
                        continue

                    if is_available:
                        continue

                    plugin = plugin_manager.plugins.pop(name, None)
                    if plugin:
                        with suppress(Exception):
                            await plugin.close()
                        removed_count += 1
                        konsol.log(f"[red][!] Eklentiye erişilemiyor ({status_code or 'ERR'}) : {plugin.name} | {plugin.main_url}")

                _availability_checked = True
                if plugin_items:
                    konsol.log(
                        f"[green]Eklenti erişim kontrolleri tamamlandı. "
                        f"({len(plugin_manager.plugins)}/{len(plugin_items)} aktif, {removed_count} kaldırıldı, max 10 eşzamanlı)"
                    )
            except Exception as hata:
                konsol.log(f"[yellow][!] Eklenti erişim kontrolü atlandı: {hata}")

    yield
