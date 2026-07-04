"""애플리케이션 설정 — server/.env 에서 로드.

정치불신 백엔드에 얹혀 있던 MEETSYNC 프록시/공유 로직을 떼어내
독립 실행하기 위한 최소 설정만 담는다. 시크릿(API 키·DB 자격증명)은
반드시 .env 로 주입하고 소스에 하드코딩하지 않는다.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # ===== Application =====
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    # uvicorn 포트. 정치불신(8000)과 분리된 MEETSYNC 전용 포트.
    port: int = 8010

    # ===== Anthropic (자연어 제약 파서 프록시) =====
    # 키 미설정 시 /parse-constraints 는 503 → 프론트가 로컬 파서로 폴백.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5"
    anthropic_timeout_s: int = 10

    # ===== Database (MariaDB, 별도 database `meetsync`) =====
    # 정치불신 MariaDB 컨테이너(127.0.0.1:3306)를 재사용하되 DB 는 분리한다.
    # 자격증명은 .env 의 DATABASE_URL 로 주입(하드코딩 금지). 아래는 개발용 기본값.
    database_url: str = (
        "mysql+pymysql://meetsync:meetsync@127.0.0.1:3306/meetsync?charset=utf8mb4"
    )
    db_pool_size: int = 5
    db_pool_timeout_s: int = 30

    # ===== CORS =====
    # 배포 프론트 오리진. 비어있으면 로컬 dev 오리진만 허용한다.
    # (경로/same-origin nginx 프록시 배포에서는 실질적으로 무해)
    meetsync_origin: str = ""


settings = Settings()
