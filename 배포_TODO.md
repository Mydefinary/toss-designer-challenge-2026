# MEETSYNC 백엔드 분리 & 배포 — 남은 작업 정리

> 대상 인프라: **정치불신(lowpolitics)** 의 docker 스택(서버·MariaDB)을 재사용.
> 목표: MEETSYNC 백엔드를 정치불신 앱(8000)에서 떼어내 **독립 백엔드(포트 8010) + 별도 DB(`meetsync`)** 로 운영.
> 작성: 2026-07-04 · 갱신 시 이 문서 유지

---

## 0. 목표 아키텍처

```
브라우저
  └─ https://<도메인>/meetsync/        (프론트 정적, nginx alias)
       └─ /api/meetsync/*  ──nginx 프록시──▶  MEETSYNC 백엔드(FastAPI, :8010)
                                                    └─ MariaDB `meetsync` DB
                                                        (정치불신 MariaDB 컨테이너 재사용, lowpolitics 와 분리)
- same-origin(같은 도메인) 이므로 CORS 불필요. 자연어 파서는 :8010 이 Anthropic 호출(키는 서버 env).
```

---

## 1. 완료된 것 ✅

### 프론트 (MEETSYNC repo — 커밋·GitHub push 완료)
- 5개 화면 + 공유/코멘트 UI, "저장 공유" 버튼(순위 헤더 우측), "필수참석/선택참석" 라벨
- 경로 배포(`/meetsync`) 설정: `vite base` 조건부, API **same-origin 상대경로**(`/api/meetsync/*`)
- dev 프록시 대상 **:8010** (`vite.config.ts` `server.proxy`)

### 독립 백엔드 (MEETSYNC repo `server/` — **아직 미커밋**)
- FastAPI: `POST /api/meetsync/parse-constraints`(Anthropic 프록시 + 프롬프트 인젝션 방지) · `shares`·`comments` CRUD
- 포트 8010, 기동 시 `create_all` 로 테이블 자동 생성
- `server/.env` 생성됨: `app` 계정 → `meetsync` DB, `ANTHROPIC_MODEL=claude-haiku-4-5`, **키는 mock**(sk-ant-mock-…)
- `.venv` + 의존성 설치 완료(fastapi/uvicorn/sqlalchemy/pymysql/httpx/pydantic-settings)

---

## 2. 남은 작업 (TODO)

### ⛔ 블로커: (A) meetsync DB 생성 — root 권한 필요
정치불신 MariaDB 에 `meetsync` DB 생성 + `app` 계정 권한 부여. **root 비밀번호가 필요**(현재 내 자격증명으론 막힘).
```bash
cd c:\개발\정치불신
docker compose exec mariadb mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS meetsync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON meetsync.* TO 'app'@'%'; FLUSH PRIVILEGES;"
```

### (B) 백엔드 기동 + 검증  ← DB 생성 후 자동 진행 가능
```bash
cd "C:\개발\toss product designer challenge 2026\server"
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
# 검증(curl): POST /api/meetsync/shares → {id}, GET /shares/{id}, comments
```

### (C) 커밋 (MEETSYNC repo)
- `server/**`(독립 백엔드), `vite.config.ts`(proxy 8010), `.gitignore`, `.env.example`, `README.md`
- `server/.env` 는 커밋 금지(gitignore 됨)

### (D) 정치불신에서 meetsync 제거 (독립 후 원복)
정치불신은 원래 상태로 되돌린다. 순서 주의(백엔드 8010 동작 확인 후):
1. **DB 테이블 제거**: `docker compose exec backend alembic downgrade 7b2f23a7b2cc` (meetsync_shares/comments drop)
2. **코드 revert**: 로컬 커밋 `a79b368`, `23c55ec` revert (또는 파일 제거) — `models/meetsync.py`, `schemas/meetsync.py`, `routers/meetsync.py`, `alembic/versions/a1b9c7d3e5f2_*.py`, `models/__init__.py`(meetsync export 줄), `docs/MEETSYNC_PROXY.md`
3. **config/main 라인 제거**(미커밋): `config.py`의 `anthropic_timeout_s`·`meetsync_origin`, `main.py`의 meetsync import·CORS·`include_router` — ⚠ **observability(glitchtip) 미커밋 작업과 같은 파일에 섞여 있으니 meetsync 줄만** 제거
4. **.env 원복**: `ANTHROPIC_API_KEY`/`MODEL` 을 원래대로 → 백업 `c:\개발\정치불신\.env.bak.meetsync` 참고
5. **`backend/nul`** 삭제(사용자 직접)

### (E) 실제 배포 (프로덕션)
- **백엔드 실행**: `server/` 를 정치불신 서버에서 상시 구동. 택1
  - 정치불신 `docker-compose.yml` 에 `meetsync-backend` 서비스 추가(같은 network, mariadb 접근, 8010)
  - 또는 systemd/uvicorn(+gunicorn) 로 8010 상시 실행
- **nginx**(정치불신 frontend): 아래 추가 — ⚠ `frontend/nginx.conf` 는 사용자 미커밋 작업 있음, 직접 반영 권장
  ```nginx
  location /meetsync/ { alias /var/www/meetsync/; try_files $uri $uri/ /meetsync/index.html; }
  location /api/meetsync/ { proxy_pass http://127.0.0.1:8010; proxy_set_header Host $host; }
  ```
- **프론트 빌드 배포**: `npm run build` → `dist/` 를 위 `/var/www/meetsync/` 로 복사
- **DB 접속**: 컨테이너로 실행 시 `server/.env` 의 `DATABASE_URL` host 를 `127.0.0.1` → mariadb 서비스명(`mariadb`)으로

### (F) 실제 Anthropic 키
- `server/.env` 의 `ANTHROPIC_API_KEY` 를 **실제 키**로 교체하면 자연어 파서가 Claude(haiku)로 동작. mock 이면 401→프론트 로컬 규칙기반 파서로 폴백(동작엔 지장 없음).

---

## 3. 필요한 것 (사용자 제공/결정)

| # | 필요 항목 | 용도 |
|---|-----------|------|
| 1 | **MariaDB root 비밀번호** (또는 위 SQL 직접 실행) | `meetsync` DB 생성·GRANT (블로커 A) |
| 2 | **실제 Anthropic API 키** | 자연어 파서 Claude 연동 (F). 없으면 로컬 파서로 동작 |
| 3 | **배포 방식 결정** | 백엔드 상시구동(docker-compose 통합 vs systemd), nginx 반영 (E) |
| 4 | **프로덕션 도메인/오리진** | nginx location·CORS(same-origin 이면 불필요) |

---

## 4. 참고: 현재 파일/커밋 상태

- 프론트 최신 커밋(GitHub `origin/master`): 저장공유·라벨(`a4568cf`) 등
- 정치불신 meetsync 커밋(로컬만, **원격 없음**): `23c55ec`(파서 프록시), `a79b368`(공유·코멘트) — (D)에서 제거 대상
- 정치불신 `lowpolitics` DB: `meetsync_shares`·`meetsync_comments` 테이블 존재(마이그레이션 `a1b9c7d3e5f2` 적용됨) — (D-1)에서 drop
- MEETSYNC `server/`: 미커밋, `server/.env`(로컬) 준비됨
