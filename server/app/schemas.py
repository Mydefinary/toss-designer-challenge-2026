"""MEETSYNC API 스키마 (요청/응답 모델).

정치불신과 동일 계약 유지: 입력 상한(text 2000자, author 40자, text 1000자)도 동일.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class MeetsyncAttendee(BaseModel):
    """참석자 (파싱 참고용 최소 정보)."""

    id: str
    name: str


class MeetsyncDateRange(BaseModel):
    """조율 대상 기간."""

    start: str
    end: str


class MeetsyncConfig(BaseModel):
    """파싱에 필요한 최소 설정."""

    durationMinutes: int
    dateRange: MeetsyncDateRange


class ParseConstraintsRequest(BaseModel):
    """제약 파싱 요청. text 길이 상한 2000자로 방어."""

    text: str = Field(..., max_length=2000)
    attendees: list[MeetsyncAttendee] = Field(default_factory=list)
    config: MeetsyncConfig


class ConstraintCell(BaseModel):
    """추출된 제약 셀. blockIndex 규약은 프론트가 최종 검증."""

    attendeeId: str
    day: int
    blockIndex: int
    status: str
    reason: str = ""


class ParseConstraintsResponse(BaseModel):
    """제약 파싱 응답."""

    cells: list[ConstraintCell]
    message: str
    unresolved: list[str] = Field(default_factory=list)


class ShareCreateIn(BaseModel):
    """공유 생성 요청. 화면3 상태 스냅샷을 통째로 받는다."""

    snapshot: dict[str, Any]


class ShareCreateOut(BaseModel):
    """공유 생성 응답. 공유 토큰만 반환."""

    id: str


class ShareOut(BaseModel):
    """공유 스냅샷 조회 응답."""

    id: str
    snapshot: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentIn(BaseModel):
    """코멘트/투표 작성 요청. vote·text 중 하나 이상은 라우터에서 검증."""

    author: str = Field(..., min_length=1, max_length=40)
    rank: int | None = None
    vote: Literal["up", "down"] | None = None
    text: str | None = Field(None, max_length=1000)


class CommentOut(BaseModel):
    """코멘트 단건 응답."""

    id: int
    author: str
    rank: int | None
    vote: Literal["up", "down"] | None
    text: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentsOut(BaseModel):
    """코멘트 목록 응답."""

    comments: list[CommentOut]
