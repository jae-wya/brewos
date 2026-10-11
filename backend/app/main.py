from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import auth, menu, menu_manage, orders, queue

settings = get_settings()

app = FastAPI(
    title="BrewOS API",
    description="Café operations system API",
    version="0.1.0"
)

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