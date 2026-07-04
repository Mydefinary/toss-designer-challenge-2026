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


class MeetingCreateIn(BaseModel):
    """회의 저장 요청."""

    ownerToken: str = Field(..., min_length=1, max_length=64)
    title: str | None = Field(None, max_length=120)
    data: Any = None  # dict 또는 임의; None이면 라우터에서 {} 처리


class MeetingUpdateIn(BaseModel):
    """회의 부분 갱신 요청. ownerToken 전달 시 소유권 검증에 사용."""

    ownerToken: str | None = None
    title: str | None = Field(None, max_length=120)
    data: Any = None


class MeetingOut(BaseModel):
    """회의 단건 응답."""

    id: str
    title: str
    data: Any
    createdAt: datetime
    updatedAt: datetime


class MeetingListItem(BaseModel):
    """회의 목록 항목(data 제외로 가볍게)."""

    id: str
    title: str
    createdAt: datetime
    updatedAt: datetime


class MeetingListOut(BaseModel):
    """회의 목록 응답."""

    meetings: list[MeetingListItem]


class PresetCreateIn(BaseModel):
    """프리셋 저장 요청."""

    ownerToken: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=100)
    data: Any = None  # dict 또는 임의; None이면 라우터에서 {} 처리


class PresetUpdateIn(BaseModel):
    """프리셋 부분 갱신 요청."""

    name: str | None = Field(None, max_length=100)
    data: Any = None


class PresetOut(BaseModel):
    """프리셋 단건 응답."""

    id: str
    name: str
    data: Any
    createdAt: datetime
    updatedAt: datetime


class PresetListItem(BaseModel):
    """프리셋 목록 항목(data 제외로 가볍게)."""

    id: str
    name: str
    createdAt: datetime
    updatedAt: datetime


class PresetListOut(BaseModel):
    """프리셋 목록 응답."""

    presets: list[PresetListItem]


class SuggestAttendee(BaseModel):
    """대안 제안용 참석자. 역할(role)·선택 여부(optional) 포함."""

    id: str
    name: str = ""
    role: str = ""
    optional: bool = False


class SuggestConstraintItem(BaseModel):
    """대안 제안용 제약 요약 항목(느슨한 형태로 수용)."""

    attendeeId: str = ""
    day: int | None = None
    blockIndex: int | None = None
    status: str = ""
    reason: str = ""


class SuggestAlternativeRequest(BaseModel):
    """대안 제안 요청. 회의 현재 상태 중 필요한 것만 받는다.

    - config: 회의 설정(dict; durationMinutes/location/dateRange 등 자유 형태).
    - attendees: 참석자 목록(상한 방어).
    - constraints: 제약 요약 목록(상한 방어).
    - durationMinutes: 회의 길이(분). config 안에 있어도 되고 여기로 줘도 됨.
    - dateRange: 조율 기간(dict; start/end).
    """

    config: dict[str, Any] = Field(default_factory=dict)
    attendees: list[SuggestAttendee] = Field(default_factory=list, max_length=50)
    constraints: list[SuggestConstraintItem] = Field(
        default_factory=list, max_length=500
    )
    durationMinutes: int | None = None
    dateRange: MeetsyncDateRange | None = None


class AlternativeSuggestion(BaseModel):
    """대안 1건. cost 는 low|medium|high."""

    title: str
    detail: str = ""
    cost: str = "medium"


class SuggestAlternativeResponse(BaseModel):
    """대안 제안 응답."""

    suggestions: list[AlternativeSuggestion]
    source: str = "claude"
