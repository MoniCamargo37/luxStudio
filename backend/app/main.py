from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import ldt, calculate, report

app = FastAPI(title="LUX Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ldt.router, prefix="/api/ldt", tags=["LDT"])
app.include_router(calculate.router, prefix="/api", tags=["Calculate"])
app.include_router(report.router, prefix="/api/report", tags=["Report"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
