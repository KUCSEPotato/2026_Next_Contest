# 🚀 Devory

> **팀 협업을 위한 올인원 플랫폼**  
> 아이디어에서 프로젝트 완성까지, 팀 기반 개발 경험을 한 곳에서 관리하세요.

Devory는 팀 협업, 프로젝트 관리, 커뮤니티 피드백을 통합한 프로덕션급 플랫폼입니다.  
강력한 백엔드 API와 실시간 기능으로 팀의 생산성을 극대화합니다.

---

## ✨ 핵심 기능

### 🤝 팀 협업
- **프로젝트 관리**: 아이디어 제시부터 프로젝트 실행, 완료까지 전 과정 관리
- **멤버 매칭**: 기술, 관심사 기반으로 팀원 추천 및 협력
- **실시간 채팅**: 팀 내 소통을 위한 직관적 메시징
- **투두/마일스톤**: 프로젝트 진행 상황을 체계적으로 추적

### 💡 프로젝트 생명주기
- **아이디어 공유**: 개인의 아이디어를 커뮤니티에 공개
- **팀 모집**: 필요한 기술 스택과 역할에 맞는 팀원 모집
- **협업 진행**: 투두, 회고, 리뷰를 통한 팀 협업
- **경험 기록**: 실패 경험과 배운 점을 기록하고 공유

### 🌟 커뮤니티 & 추천
- **피드 시스템**: 팀의 활동과 성과를 실시간으로 공유
- **평점/리뷰**: 팀원의 협업 능력을 객관적으로 평가
- **스마트 추천**: AI 기반 팀원 및 프로젝트 추천
- **포인트 이코노미**: 활동 기반 코인 보상 시스템

### 🔐 안전한 인증
- **소셜 로그인**: GitHub, Google을 통한 한 번에 시작
- **토큰 관리**: 안전한 Access/Refresh 토큰 시스템
- **계정 연결**: 여러 OAuth 계정 통합 관리

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| **Backend** | FastAPI + SQLAlchemy |
| **Database** | PostgreSQL (주 저장소) |
| **Real-time** | Redis (토큰/세션 저장) |
| **Monitoring** | Prometheus + Grafana |
| **Container** | Docker & Docker Compose |
| **Authentication** | JWT + OAuth 2.0 |

---

## 📊 데이터베이스 아키텍처

Devory의 확장 가능한 스키마 설계로 안정적인 팀 협업 환경을 제공합니다.

![Database Schema](/IMG/[0514]DB.png)

**주요 엔티티**:
- **사용자 & 인증**: 계정 관리, 소셜 연동
- **아이디어 & 프로젝트**: 생명주기 관리, 기술 스택 추적
- **팀 협업**: 멤버, 투두, 회고, 리뷰
- **커뮤니티**: 피드, 포스트, 반응
- **결제 & 구독**: 유연한 플랜 시스템
- **코인 이코노미**: 활동 기반 보상

---

## 🚀 빠른 시작

### 로컬 개발 환경 (3분 셋업)

**1단계: 저장소 클론**
```bash
git clone https://github.com/your-org/devory.git
cd devory/BE
```

**2단계: 환경 변수 설정**
```bash
cp .env.example .env
```

**3단계: 서버 실행**
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**접근 주소**:
- 🌐 API: http://localhost:8000
- 📚 Swagger (대화형 API 문서): http://localhost:8000/docs
- 📖 ReDoc: http://localhost:8000/redoc

### Docker로 빠르게 시작

```bash
cd BE/docker
docker compose up -d
```

**서비스 주소**:
- API: http://localhost:8000
- 모니터링: http://localhost:9090 (Prometheus)
- 대시보드: http://localhost:3001 (Grafana)

---

## 📋 API 예시

### 로그인
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

**응답**:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 프로젝트 목록 조회
```bash
curl http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

더 많은 API 예시는 Swagger 문서(http://localhost:8000/docs)에서 직접 테스트할 수 있습니다.

---

## 🔐 보안 & 프로덕션 체크리스트

### 환경 변수 설정
| 환경 | 특징 | 참고 |
|------|------|------|
| **개발** | 로컬 테스트용 | `.env.example` 기본값 |
| **운영** | 강한 보안 | `JWT_SECRET_KEY`, DB 비밀번호 반드시 변경 |

### 배포 전 필수 확인사항
✅ GitHub/Google OAuth Redirect URI와 프론트엔드 callback URL 일치  
✅ `JWT_SECRET_KEY`를 강한 랜덤 값으로 교체  
✅ PostgreSQL, Redis 비밀번호 설정  
✅ CORS, 방화벽 설정 완료  
✅ Prometheus/Grafana 접근 제어 설정  

**상세 가이드**: [BE/docker/README.md](BE/docker/README.md)

---

## 📚 상세 문서

더 깊이 있는 정보가 필요하신가요? 다음 문서들을 확인하세요.

### 백엔드 개발자 가이드
- [API 카탈로그](BE/app/api/API_CATALOG.md) - 전체 API 엔드포인트 목록
- [Swagger 테스트 가이드](BE/docs/SWAGGER_TEST_GUIDE.md) - API 대화형 테스트 방법
- [DB 스키마 & 마이그레이션](BE/docs/db/README.md) - 데이터베이스 운영 원칙
- [Redis 가이드](BE/docs/db/REDIS_GUIDE.md) - 토큰/세션 관리
- [Docker 배포 가이드](BE/docker/README.md) - 프로덕션 배포

### 프론트엔드 개발자 가이드
- [FE 문서](fe/README.md) - 프론트엔드 아키텍처 및 설정

---

## 💬 커뮤니티 & 지원

**문제를 발견했거나 개선 아이디어가 있으신가요?**

- 🐛 [이슈 보고](../../issues) - 버그 신고
- 💡 [기능 제안](../../discussions) - 새로운 아이디어 공유
- 📧 이메일: contact@devory.kr

---

## 🤝 기여하기

Devory는 오픈소스 커뮤니티의 기여를 환영합니다!

### 기여 프로세스
1. 저장소 Fork
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

### 개발 환경 셋업
```bash
# 1. 저장소 클론
git clone https://github.com/your-org/devory.git
cd devory

# 2. 개발 환경 설정
cd BE
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# or: .venv\Scripts\activate  # Windows

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 마이그레이션 & 개발 서버 실행
alembic upgrade head
uvicorn app.main:app --reload
```

---

## 📄 라이선스

이 프로젝트는 **MIT License** 하에 공개됩니다.  
[라이선스 전문](LICENSE) 확인하기

---

## ⭐ 별 주기

이 프로젝트가 도움이 되었다면 ⭐ 별을 눌러주세요!  
여러분의 관심이 팀을 계속 발전시키는 동력이 됩니다.

---

<div align="center">

**Made with ❤️ by the Devory Team**

</div>
