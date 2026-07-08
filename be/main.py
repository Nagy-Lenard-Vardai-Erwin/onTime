from endpoints import locations, register, lines, routes, stations, login, me, logout, lineStations, simulation, users, analytics, buses
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from models.errors.Errors import AppError

app = FastAPI()

origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": exc.message,
            "error_code": exc.error_code,
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations.router)
app.include_router(register.router)
app.include_router(lines.router)
app.include_router(routes.router)
app.include_router(login.router)
app.include_router(me.router)
app.include_router(stations.router)
app.include_router(logout.router)
app.include_router(lineStations.router)
app.include_router(simulation.router)
app.include_router(users.router)
app.include_router(analytics.router)
app.include_router(buses.router)

@app.on_event("startup")
def warm_analytics_cache():
    """Precompute the analytics snapshot in the background on startup so the
    first dashboard load (e.g. right after a free-tier cold start) hits a warm
    cache instead of waiting on the heavy ~130k-row computation."""
    import threading
    import analytics_service

    def _warm():
        try:
            analytics_service.get_overview()
        except Exception:
            pass

    threading.Thread(target=_warm, daemon=True).start()
