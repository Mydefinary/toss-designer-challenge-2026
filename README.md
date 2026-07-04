# MEETSYNC

**6명이 다음 주까지 1시간 회의를 잡는 경험을 설계한 인터랙티브 프로토타입.** 빈 시간을 찾는 도구가 아니라, 6명의 제약을 **투명하게 드러내 자발적 양보를 만들고**(투명성 보드 + 슬롯 드릴다운), **1~5순위 백업**으로 확정해 갑작스러운 불참(이슈)에도 흔들리지 않게 의사결정하도록 돕습니다. 회의를 여러 개 만들어 관리하고, 링크로 **실시간 공동 편집·상황 공유·코멘트**까지 이어집니다.

> 토스 프로덕트 디자이너 챌린지 2026 제출물. 제출 3가지 질문 답변은 [`질문내용.md`](./질문내용.md), 설계 배경은 [`PRD.md`](./PRD.md) 참고.

## 아키텍처 개요

```
[브라우저]  React + Vite + TS + Zustand  (정적 dist/, 경로 /meetsync 로 서빙)
    │  fetch  /api/meetsync/*   (same-origin, CORS 불필요)
    │  ws     /api/meetsync/meetings/:id/ws  (실시간 공동 편집)
    ▼
[nginx]  /meetsync/(정적) · /api/meetsync/*(→ 8010 프록시)
    ▼
[MEETSYNC 백엔드]  FastAPI (server/, 포트 8010)
    ▼
[MariaDB]  별도 database `meetsync`  (회의·프리셋·공유·코멘트 저장)
```

- **프론트엔드** — React + Vite + TypeScript(strict) + **Zustand** 전역 스토어. HashRouter로 회의별 URL(`/#/m/:id/*`) 라우팅. CSS Modules + 토스풍 디자인 토큰.
- **백엔드** — **독립 FastAPI 서버**(`server/`, 포트 8010). 회의/프리셋 CRUD, 공유·코멘트, 자연어 파서·대안 제안 Anthropic 프록시, **WebSocket 실시간 편집**을 제공. 기동 시 `create_all`로 테이블 자동 생성.
- **DB** — 정치불신(lowpolitics) MariaDB 컨테이너를 재사용하되 **별도 database `meetsync`**로 완전히 분리.
- **배포** — 기존 사이트의 **경로 `/meetsync`** 아래에 서빙(same-origin). 공개 URL: **`https://lowpolitics.com/meetsync/`**.

## 주요 기능

- **회의 멀티 관리** — 회의마다 고유 id·URL(`/#/m/:id/*`). 홈은 **회의 목록**(카드형 · "회의 만들기" · "예시로 시작" · 프리셋에서 만들기)이며, 백엔드에 저장/불러오기. `ownerToken`(localStorage)으로 "내가 만든 회의"를 식별해 목록·삭제 권한을 구분한다.
- **실시간 공동 편집** — 회의별 WebSocket room으로 다중 접속자가 편집을 즉시 동기화(last-write-wins). **편집은 개방**(링크 소지자 누구나), 목록·삭제만 소유자 권한. 연결 실패 시 지수 백오프 재연결, WS 없어도 앱은 정상 동작.
- **상황 공유 + 코멘트** — 화면3(추천 결과)의 검토 상태(1~5순위 + 모두의 상황 히트맵)를 DB에 스냅샷 저장 → `/#/shared/:id` **읽기 전용 링크** 발급. 열람자는 순위별 👍/👎 투표와 코멘트를 남길 수 있다.
- **프리셋** — 참석자·역할·장소·제약을 프리셋으로 저장/불러오기. 새 회의를 프리셋에서 바로 생성.
- **자연어 제약 입력** — 문장으로 제약을 입력하면 백엔드 프록시가 **Claude(haiku)**로 파싱. 실패/미설정 시 **로컬 규칙기반 파서로 자동 폴백**하므로 백엔드 없이도 항상 동작. 프롬프트 인젝션 방어(역할 고정·`<user_input>` 격리·스키마 화이트리스트) 적용, 멀티라인 입력 지원.
- **회의실 = 참석자처럼** — 통합 회의실 가용(`config.roomBusy`)으로 오프라인 회의실을 하나의 가용 주체로 다룬다. 제약 격자·투명성 보드에 **회의실 행**이 함께 노출된다.
- **추천 고도화** — 30분 블럭·가변 회의 길이(30/60/90/120)·날짜범위 캘린더. 점수·tie-break·**순위 다양성**으로 1~5순위 선별. 제약 완화 제안 풀버전. 후보가 부족하면 **최소 비용 대안(규칙기반)** + **Claude 대안 제안**을 제시. 오프라인인데 점유 구간을 커버하는 회의실이 없으면 후보에서 제외(Hard).

## 5개 화면 흐름

```
회의 목록 → 회의 생성 → 제약 입력 → 추천 결과 → 확정 → 운영(이슈 대응)
```

1. **회의 생성** — 제목, 회의 길이(30/60/90/120), 날짜범위 캘린더, 온라인/오프라인(회의실 목록), 참석자 추가/삭제(2~12명, 필수/선택 토글).
2. **제약 입력** — 버튼형(격자 셀에 브러시로 가능/회피/불가·불가 사유) + 자연어 대화형(문장 파싱, 격자 즉시 반영)을 탭 전환. 격자는 상시 노출. 점심(11:30–13:00)은 기본 불가로 합성. 프리셋으로 저장 가능.
3. **추천 결과 (핵심 화면)** — (a) **투명성 보드**(참석자·회의실 × 시간블럭 히트맵), (b) **1~5순위 후보 카드**(만족 인원·양보 주체·장소 뱃지), (c) **슬롯 드릴다운**(왜 부적합한지), (d) **제약 완화·대안 제안**. 하단 "이 상황 공유하기"로 스냅샷 공유.
4. **확정** — 1~5순위 확정. 순위별 참석·양보·불참·역할을 상세히 보여주고 저장/공유.
5. **운영(이슈 대응)** — 확정된 1~5순위를 전부 나열해 비교하고 **최종 선택을 라디오로 지정**. 이슈가 생기면 다른 순위를 최종으로 다시 지정하고 재공유.

## 데모 시나리오 5종

상단 셀렉터로 즉시 전환합니다. 각 시나리오는 서로 다른 엣지케이스를 자극하도록 설계됐습니다.

| # | 이름 | 검증 목적 |
|---|------|-----------|
| 1 | **전형적 충돌** | 모든 변수(필수/선택·3단계 상태·오프라인 장소)가 한 번에 작동 |
| 2 | **완벽한 시간 없음** | 모든 슬롯에 최소 1명 회피/불가 → "양보 없이는 불가능"을 증명 |
| 3 | **필수자 충돌 (후보 희소)** | 후보가 희소·전무 → 완화·대안 제안으로 전환 |
| 4 | **장소 병목** | 시간은 OK인데 회의실이 부족해 장소가 결정 요인 |
| 5 | **이슈 대응 (다음 순위)** | 확정 후 1순위가 무너졌을 때 다음 순위 이동 |

## 로컬 실행

### 프론트엔드

```bash
npm i          # 의존성 설치
npm run dev    # 개발 서버 (http://localhost:5173, base '/')
npm run build  # 타입체크(tsc --noEmit) + 프로덕션 빌드(base '/meetsync/') → dist/
npm test       # Vitest 단위 테스트
```

- dev에서는 `vite.config.ts`의 `server.proxy`가 `/api` → `http://localhost:8010`으로 프록시해 same-origin처럼 동작합니다.
- API base는 기본 상대경로(same-origin)이며, 다른 오리진 백엔드를 쓸 때만 `VITE_API_BASE`에 절대 URL을 지정합니다. 설정 예시는 [`.env.example`](./.env.example) 참고.

### 백엔드 (`server/`)

```bash
# 1) DB 준비(최초 1회): MariaDB에 database `meetsync` 생성
#    CREATE DATABASE meetsync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# 2) env 설정
cp server/.env.example server/.env   # DATABASE_URL, ANTHROPIC_API_KEY 등 채우기
# 3) 기동 (포트 8010)
cd server
python -m venv .venv && source .venv/bin/activate   # (Windows Git Bash: . .venv/Scripts/activate)
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

- 기동 시 테이블을 자동 생성(`create_all`). DB 접속 실패 시에도 서버는 뜨며 DB 불필요 엔드포인트(파서)는 계속 동작합니다.
- API 키(`ANTHROPIC_API_KEY`)는 **백엔드 env에만** 존재하고 프론트/브라우저에는 노출되지 않습니다. 자세한 절차는 [`server/README.md`](./server/README.md) 참고.

## 배포 (경로 `/meetsync`)

MEETSYNC는 별도 도메인이 아니라 **기존 사이트(정치불신/lowpolitics)의 경로 `/meetsync`** 아래에 서빙합니다. 백엔드 API는 **같은 오리진의 `/api/meetsync/*`**를 호출하므로 same-origin이라 CORS가 필요 없습니다.

- **정적 서빙** — `npm run build`로 `base '/meetsync/'` 빌드 → `dist/`를 `/meetsync/`로 서빙. 정치불신 frontend 이미지 빌드 시 MEETSYNC `dist/`를 함께 베이크해 서빙합니다.
- **백엔드 서비스** — 정치불신 `docker-compose.yml`에 `meetsync-backend` 서비스(이 repo의 `server/`)를 추가해 8010에서 기동. 기존 도커 스택을 재사용합니다.
- **nginx** — `/meetsync/`(정적) · `/api/meetsync/*`(→ 8010) · `/api/meetsync/meetings/:id/ws`(WebSocket 업그레이드) 프록시.

```nginx
location /meetsync/ {
    alias /var/www/meetsync/;
    try_files $uri $uri/ /meetsync/index.html;
}
# /api/meetsync/ 는 8010 백엔드로 프록시(WebSocket 업그레이드 헤더 포함) → same-origin 유지
```

> HashRouter라 서브경로 라우팅 자체는 base와 무관하게 동작하지만, asset(js/css) 경로 때문에 `vite.config.ts`의 `base`가 프로덕션에서 `'/meetsync/'`로 설정되어 있습니다(개발은 `'/'`).

## 공개 URL

- 데모: **https://lowpolitics.com/meetsync/**
- 소스: GitHub(비공개 저장소)

## 제출물

- [`질문내용.md`](./질문내용.md) — 제출 3가지 질문 답변(문제 정의 → 해결 → 설계 근거).
- [`PRD.md`](./PRD.md) — 제품 요구사항 정의서(문제 정의·솔루션·설계 근거·구현 현황).
