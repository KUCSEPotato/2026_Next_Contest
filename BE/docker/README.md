# Docker Setup

이 폴더는 Devory 백엔드의 Docker 실행 구성을 담습니다.

## 파일
- `docker-compose.yml`: API + PostgreSQL + Redis 통합 실행
- `Dockerfile`: FastAPI 애플리케이션 이미지 빌드
- `monitoring/prometheus.yml`: Prometheus 스크랩 설정

## 실행 방법
1. 루트 `BE` 경로에서 환경 파일 준비
```bash
cp .env.example .env
```
2. Redis 설정 확인
- 로컬 직접 실행이면 `REDIS_URL=redis://127.0.0.1:6379/0`
- Docker Compose 실행이면 `REDIS_URL=redis://redis:6379/0`
2. Docker 실행
```bash
cd docker
docker compose up -d --build
```
3. 상태 확인
```bash
docker compose ps
```
4. 로그 확인
```bash
docker compose logs -f api
docker compose logs -f db
docker compose logs -f prometheus
docker compose logs -f grafana
```

## 모니터링 접속
- Prometheus: `http://127.0.0.1:9090`
- Grafana: `http://127.0.0.1:3001`
- API metrics: `http://127.0.0.1:8000/metrics`

## 초기화
```bash
cd docker
docker compose down -v
docker compose up -d --build
```
