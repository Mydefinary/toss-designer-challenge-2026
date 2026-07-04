"""DB 엔진 / 세션 / Base — SQLAlchemy 2.x 동기 모드.

alembic 없이 기동 시 Base.metadata.create_all 로 테이블을 생성한다(init_db).
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=20,
    pool_timeout=settings.db_pool_timeout_s,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """모든 ORM 모델의 베이스."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI 의존성: 요청 단위 세션."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """기동 시 테이블 생성. 모델을 import 해 metadata 에 등록한 뒤 create_all."""
    # 모델을 Base.metadata 에 등록시키기 위한 import (side-effect)
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
