# MEETSYNC 독립 백엔드 이미지
FROM python:3.12-slim

WORKDIR /app

# 의존성 먼저 설치(레이어 캐시)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드
COPY app ./app

# 포트 8010 노출
EXPOSE 8010

# .env 의 PORT 를 쓰려면 compose/런타임에서 명시. 기본 8010 고정 실행.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
