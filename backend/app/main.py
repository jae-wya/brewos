import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import auth, menu, menu_manage, orders, queue, sales, settings as settings_router

settings = get_settings()
log = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="BrewOS API",
    description="Café operations system API",
    version="0.1.0"
)


# Unhandled exceptions become a 500 the browser can actually read.
#
# Starlette turns an unhandled exception into a 500 in ServerErrorMiddleware,
# which sits OUTSIDE CORSMiddleware, so that response has no CORS header and
# the browser hides it: the phone saw a network failure and said "Couldn't
# reach the server. Check your connection." for what was really a bug. An
# @app.exception_handler(Exception) doesn't help — Starlette attaches that
# one to ServerErrorMiddleware too.
#
# This catches the exception INSIDE CORSMiddleware instead. Middleware added
# later wraps middleware added earlier, so it must be registered BEFORE
# add_middleware(CORSMiddleware) below. The reference goes in her message and
# beside the traceback in the Render log, so a report can be found.
@app.middleware("http")
async def unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        ref = uuid.uuid4().hex[:8]
        log.exception("Unhandled error ref=%s on %s %s", ref, request.method, request.url.path)
        return JSONResponse(status_code=500, content={
            "detail": f"Something went wrong on the server — not your connection. Try again; if it keeps happening, send Jae this code: {ref}.",
        })


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,   prefix="/auth",   tags=["Auth"])
app.include_router(menu.router,   prefix="/menu",   tags=["Menu"])
app.include_router(menu_manage.router, prefix="/menu", tags=["Menu management"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(queue.router,  prefix="/queue",  tags=["Queue"])
app.include_router(sales.router,  prefix="/sales",  tags=["Sales"])
app.include_router(settings_router.router, prefix="/settings", tags=["Settings"])

# FastAPI's default 422 is a list of error objects. The frontend shows
# `detail` to her as-is, so return the first problem as one sentence, plus
# which field it belongs to so the form can show it under that field.
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "Something in that request isn't valid.")).removeprefix("Value error, ")
    loc = first.get("loc") or ()
    return JSONResponse(status_code=422, content={"detail": message, "field": loc[-1] if loc else None})


@app.get("/")
def root():
    return {"status": "ok", "app": "BrewOS API", "version": "0.1.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}