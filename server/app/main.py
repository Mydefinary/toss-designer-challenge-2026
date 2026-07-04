"""MEETSYNC 독립 백엔드 FastAPI 진입점.

기동 시 init_db 로 테이블을 생성(alembic 없이 create_all)하고,
/api/meetsync/* 라우터를 등록한다. 포트 8010.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import meetsync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("meetsync")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("MEETSYNC 백엔드 기동 (env=%s, port=%s)", settings.app_env, settings.port)
    # 기동 시 테이블 생성. DB 미접속 시에도 서버 자체는 뜨도록 예외를 삼킨다
    # (parse-constraints 등 DB 불필요 엔드포인트는 계속 동작).
    try:
        init_db()
        log.info("DB 테이블 준비 완료")
    except Exception as exc:  # noqa: BLE001 — DB 없이도 기동은 허용
        log.warning("DB 초기화 실패 — 공유/코멘트 기능 비활성 상태로 기동: %s", exc)
    yield
    log.info("MEETSYNC 백엔드 종료")


app = FastAPI(
    title="MEETSYNC API",
    description="MEETSYNC 전용 백엔드 — 자연어 제약 파서 프록시 + 공유/코멘트",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: 로컬 dev 프론트 오리진 허용. 배포 오리진은 env(MEETSYNC_ORIGIN)로 추가.
# 경로/same-origin nginx 프록시 배포에서는 실질적으로 무해(브라우저가 same-origin).
# dev 는 vite 프록시가 same-origin 처럼 동작하므로 CORS 는 주로 직접 호출 대비용.
allowed_origins = ["http://localhost:5175", "http://localhost:5173"]
if settings.meetsync_origin:
    allowed_origins.append(settings.meetsync_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(meetsync.router)


@app.get("/")
def root() -> dict[str, str]:
    """루트 응답. 정상 기동 여부 빠른 확인용."""
    return {
        "service": "meetsync",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, str]:
    """헬스체크."""
    return {"status": "ok"}
