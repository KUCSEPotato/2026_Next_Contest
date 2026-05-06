# GitHub 작업 규칙

본 프로젝트는 협업을 위해 Feature Branch 기반의 Git Workflow를 사용합니다.
모든 팀원은 아래 규칙을 기준으로 작업을 진행해 주세요.

---

## 1. 브랜치 전략 (Branch Strategy)

본 프로젝트는 다음과 같은 브랜치를 사용합니다.

- **main 브랜치**
  - 배포용 브랜치
  - 안정적으로 동작하는 코드만 포함됩니다.
- **develop 브랜치**
  - 통합 개발 브랜치
  - 여러 기능이 합쳐지는 브랜치입니다.
- **feature 브랜치**
  - 본인 포지션 단위로 작업하는 브랜치
  - 형식: `feature/[본인 포지션]` (예: `feature/BE`, `feature/FE`)
  - develop 브랜치에서 생성합니다.

---

## 2. 기본 작업 흐름 (Workflow)

개발 작업은 다음 순서로 진행됩니다.

```
main
 ↑
develop
 ↑
feature/*
```

### 작업 단계

#### 1️⃣ develop 브랜치에서 feature/[본인 포지션] 브랜치 생성

```bash
git checkout develop
git pull origin develop
git checkout -b feature/[본인 포지션]
```

**예시**

```bash
git checkout -b feature/BE
```

---

#### 2️⃣ feature/[본인 포지션] 브랜치에서 작업

- 기능 구현
- 버그 수정
- 테스트

작업 후 커밋합니다.

```bash
git add .
git commit -m "feat: 로그인 API 구현"
```

---

#### 3️⃣ 작업 완료 후 feature/[본인 포지션] 브랜치를 develop 브랜치로 PR

작업이 완료되면 Pull Request(PR) 를 생성합니다.

```
feature/[본인 포지션] → develop
```

리뷰 후 develop 브랜치로 머지됩니다.

---

#### 4️⃣ develop 브랜치를 main으로 머지

개발이 안정화되면 다음 단계로 진행합니다.

```
develop → main
```

main 브랜치는 배포용 브랜치로 사용됩니다.

---

## 3. Pull Request 작성 규칙

PR을 생성할 때는 작업 내용과 수정된 부분을 간단하게 작성해 주세요.

**PR 작성 내용**

- 구현한 기능
- 수정한 부분
- 테스트 방법 (필요 시)

**예시**

```markdown
### 변경 내용
- 로그인 API 구현
- JWT 인증 로직 추가

### 수정 파일
- auth/service.py
- auth/router.py
```

---

## 4. Commit 메시지 규칙

커밋 메시지는 어떤 작업을 했는지 명확하게 작성해 주세요.

좋은 예시: "로그인 API 구현, BE 1차 API 작성 완료"
나쁜 예시: "커밋" 또는 "수정"

---

## 5. 작업 시 유의사항

- 항상 develop 브랜치 기준으로 `feature/[본인 포지션]` 브랜치를 생성합니다.
- 작업은 반드시 `feature/[본인 포지션]` 브랜치에서 진행합니다.
- PR을 보내기 전에 코드가 정상적으로 동작하는지 확인해 주세요.
- 커밋은 작은 단위로 나누어 작성하는 것을 권장합니다.

---

## 6. 전체 Workflow 요약

1. develop 브랜치에서 `feature/[본인 포지션]` 브랜치 생성
2. `feature/[본인 포지션]` 브랜치에서 기능 개발
3. 작업 완료 후 `feature/[본인 포지션]` → develop PR 생성
4. develop 브랜치에 기능 통합
5. develop → main 머지 후 배포

```
main
 ↑
develop
 ↑
feature/*
```

이 구조를 통해 안정적인 배포와 효율적인 협업을 진행합니다.

---
## 7. 기타 사항
- 작업 중 문제가 발생하면 팀원과 상의하여 해결합니다.
- Github과 관련하여 문제가 발생하면, 그 즉시 GitHub 관리자에게 연락해주시기 바랍니다.
- Github 사용과 관련하여 생성형 AI 도구를 사용하되 그 명령어 실행의 결과가 정확한지 반드시 검증해야 합니다. AI 도구가 생성한 코드나 명령어는 오류가 있을 수 있으므로, 사용 전에 반드시 검토해주세요.