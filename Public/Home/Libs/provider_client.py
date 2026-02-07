# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

import httpx
from typing import Any

class RemoteProviderClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client   = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        self._schema  = None

    async def _get(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:
        try:
            response = await self.client.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and "result" in data:
                return data["result"]
            return data
        except httpx.TimeoutException:
            raise ValueError(f"Provider zaman aşımı: {self.base_url}")
        except httpx.HTTPStatusError as e:
            raise ValueError(f"Provider hatası ({e.response.status_code}): {self.base_url}")
        except Exception as e:
            raise ValueError(f"Provider bağlantı hatası: {str(e)}")

    async def get_schema(self) -> dict[str, Any]:
        """Provider schema'sını çeker ve önbelleğe alır"""
        if self._schema is None:
            self._schema = await self._get("/api/v1/schema") or {}
        return self._schema

    async def get_provider_name(self) -> str:
        """Provider name'i schema'dan çeker"""
        schema = await self.get_schema()
        return schema.get("provider_name", "Remote Provider")

    async def get_proxy_urls(self) -> dict:
        """Provider'dan proxy URL'lerini çeker"""
        schema = await self.get_schema()
        return {
            "proxy_url"          : schema.get("proxy_url", self.base_url),
            "proxy_fallback_url" : schema.get("proxy_fallback_url", "")
        }

    async def get_plugins(self) -> list[dict[str, Any]]:
        res = await self._get("/api/v1/get_all_plugins")
        return res if isinstance(res, list) else []

    async def get_plugin(self, plugin_name: str) -> dict[str, Any] | None:
        return await self._get("/api/v1/get_plugin", params={"plugin": plugin_name})

    async def get_main_page(self, plugin_name: str, url: str, page: int = 1, category: str = "") -> list[dict[str, Any]]:
        res = await self._get("/api/v1/get_main_page", params={
            "plugin"           : plugin_name,
            "page"             : str(page),
            "encoded_url"      : url,
            "encoded_category" : category
        })
        return res if isinstance(res, list) else []

    async def search(self, plugin_name: str, query: str, page: int = 1) -> list[dict[str, Any]]:
        res = await self._get("/api/v1/search", params={
            "plugin" : plugin_name,
            "query"  : query,
            "page"   : str(page)
        })
        return res if isinstance(res, list) else []

    async def load_item(self, plugin_name: str, url: str) -> dict[str, Any]:
        res = await self._get("/api/v1/load_item", params={
            "plugin"      : plugin_name,
            "encoded_url" : url
        })
        return res if isinstance(res, dict) else {}

    async def load_links(self, plugin_name: str, url: str) -> list[dict[str, Any]]:
        res = await self._get("/api/v1/load_links", params={
            "plugin"      : plugin_name,
            "encoded_url" : url
        })
        return res if isinstance(res, list) else []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
