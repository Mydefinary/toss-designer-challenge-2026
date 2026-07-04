"""MEETSYNC 공유 스냅샷 + 코멘트 ORM 모델.

화면3(조율 결과) 상태를 통째로 스냅샷 저장해 토큰으로 공유하고,
공유된 스냅샷에 순위별/전체 투표·코멘트를 남길 수 있게 한다.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MeetsyncShare(Base):
    __tablename__ = "meetsync_shares"

    # 공유 토큰(문자열 PK)
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    # 화면3 상태 전체 임의 JSON
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<MeetsyncShare id={self.id!r}>"


class MeetsyncComment(Base):
    __tablename__ = "meetsync_comments"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    share_id: Mapped[str] = mapped_column(
        String(24),
        ForeignKey("meetsync_shares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author: Mapped[str] = mapped_column(String(40), nullable=False)
    # 어느 순위 코멘트인지, null=전체
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 'up' | 'down'
    vote: Mapped[str | None] = mapped_column(String(4), nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<MeetsyncComment id={self.id} share_id={self.share_id!r}>"


class Meeting(Base):
    __tablename__ = "meetsync_meetings"

    # 회의 ID(문자열 PK)
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    # 브라우저 익명 소유자 토큰
    owner_token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 회의 제목(기본값은 파이썬 default만)
    title: Mapped[str] = mapped_column(
        String(120), nullable=False, default="제목 없는 회의"
    )
    # 회의 전체 상태(임의 JSON)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    # 생성 시각
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    # 갱신 시각
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Meeting id={self.id!r} title={self.title!r}>"


class Preset(Base):
    __tablename__ = "meetsync_presets"

    # 프리셋 ID(문자열 PK, 토큰)
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    # 브라우저 익명 소유자 토큰
    owner_token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 프리셋 이름
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 회의 설정+참석자+제약 전체 임의 JSON
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    # 생성 시각
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    # 갱신 시각
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Preset id={self.id!r} name={self.name!r}>"
