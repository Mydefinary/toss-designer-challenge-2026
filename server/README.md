# MEETSYNC 백엔드 (독립 FastAPI)

MEETSYNC 전용 백엔드. **포트 8010**에서 도는 독립 서비스다. DB는
기존 호스팅 MariaDB를 재사용하되 **별도 database `meetsync`** 를 사용해
기존 DB와 완전히 분리한다.

## 구조

```
server/
├── app/
│   ├── main.py            # FastAPI 앱, CORS, lifespan(init_db)
│   ├── config.py          # pydantic-settings (.env 로드)
│   ├── db.py              # engine / SessionLocal / get_db / init_db(create_all)
│   ├── models.py          # MeetsyncShare, MeetsyncComment (ORM)
│   ├── schemas.py         # 요청/응답 Pydantic 모델
│   └── routers/
│       └── meetsync.py    # /api/meetsync/* 엔드포인트
├── requirements.txt
├── .env.example           # → .env 로 복사해 사용 (git 무시)
├── Dockerfile
└── docker-compose.yml
```

## 엔드포인트 (prefix `/api/meetsync`)

엔드포인트 목록:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/parse-constraints` | 자연어 제약 → 셀 목록. Anthropic 프록시. 키 없으면 503(프론트 로컬 파서 폴백) |
| POST | `/shares` | `{snapshot}` → `{id}` (공유 토큰 발급) |
| GET | `/shares/{id}` | 공유 스냅샷 조회 |
| POST | `/shares/{id}/comments` | 투표/코멘트 작성 (vote·text 중 하나 필수) |
| GET | `/shares/{id}/comments` | 코멘트 목록(생성순) |

그 외: `GET /` (기동 확인), `GET /health`, `GET /docs`(Swagger).

**입력 방어**: `parse-constraints.text` 최대 2000자, 코멘트 `author` 1~40자,
`text` 최대 1000자. `parse-constraints` 는 프롬프트 인젝션 방어(system 프롬프트
역할 고정 + `<user_input>` 격리 + 출력 스키마 화이트리스트)를 적용한다.

## 로컬 실행

### 1) DB 준비 (최초 1회) — MariaDB 에 database + 계정 생성

MariaDB 에 `meetsync` database 와 접근 계정을 준비한다(자세한 절차는 배포
환경에 맞게 조정). 테이블은 서버 기동 시 `create_all` 로 자동 생성된다.

예시(일반적인 MariaDB 설정):

```sql
CREATE DATABASE IF NOT EXISTS meetsync
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 전용 계정 생성(권장). 비밀번호는 실제 값으로 교체.
CREATE USER IF NOT EXISTS 'meetsync'@'%' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON meetsync.* TO 'meetsync'@'%';
FLUSH PRIVILEGES;
```

> database 이름은 반드시 `meetsync`. 기존 계정을 재사용할 경우 `meetsync.*`
> 접근 권한이 있어야 한다.

### 2) env 설정

```bash
cp server/.env.example server/.env
# server/.env 를 열어 DATABASE_URL, ANTHROPIC_API_KEY 등을 채운다.
#   DATABASE_URL=mysql+pymysql://<user>:<password>@127.0.0.1:3306/meetsync?charset=utf8mb4
```

### 3) 의존성 설치 & 기동 (포트 8010)

```bash
cd server
python -m venv .venv && . .venv/Scripts/activate   # Windows (Git Bash)
# 또는:  python -m venv .venv && source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

기동 시 `init_db()` 가 `meetsync_shares`, `meetsync_comments` 테이블을 자동
생성한다(alembic 없음). DB 접속 실패 시에도 서버는 뜨며, DB 불필요 엔드포인트
(`parse-constraints`)는 계속 동작한다.

확인:

```bash
curl http://localhost:8010/health          # {"status":"ok"}
# http://localhost:8010/docs 에서 Swagger UI
```

## Docker (선택)

```bash
cd server
docker compose up --build   # 8010 노출
```

DB 접속 방식(호스트 포트 vs 기존 도커 네트워크 합류)은 `docker-compose.yml`
상단 주석 참고. 컨테이너에서 호스트 MariaDB 로 나갈 때는 `DATABASE_URL` 의
host 를 `host.docker.internal` 로 바꾼다.

## 프론트 연결

MEETSYNC 프론트는 상대경로 `/api/meetsync/*` 를 호출한다.

- **dev**: `vite.config.ts` 의 `server.proxy` 가 `/api` → `http://localhost:8010`
  으로 프록시(이 백엔드 포트).
- **배포**: nginx 가 `/api` 를 이 백엔드(8010)로 프록시해 same-origin 유지.
