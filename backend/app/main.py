from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, menu, orders, queue

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
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(queue.router,  prefix="/queue",  tags=["Queue"])

@app.get("/")
def root():
    return {"status": "ok", "app": "BrewOS API", "version": "0.1.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}