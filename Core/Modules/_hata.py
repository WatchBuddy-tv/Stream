# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from Core                 import kekik_FastAPI, Request, JSONResponse, FileResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic             import ValidationError

@kekik_FastAPI.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc):
    if exc.status_code == 404:
        return RedirectResponse(url="/", status_code=302)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@kekik_FastAPI.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Pydantic validation hatalarını JSON olarak döndür"""
    errors   = exc.errors()
    messages = [f"{e['loc'][0]}: {e['msg']}" for e in errors]

    return JSONResponse(
        status_code = 422,
        content     = {"success": False, "message": " | ".join(messages)}
    )

@kekik_FastAPI.get("/favicon.ico")
async def get_favicon():
    return FileResponse(path="Public/Home/Static/ico/favicon.ico")

@kekik_FastAPI.get("/logo.png")
async def get_logo():
    return FileResponse(path="Public/Home/Static/ico/logo.png")
