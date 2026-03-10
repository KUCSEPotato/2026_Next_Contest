# Project Graveyard
### Where unfinished projects find a second life

Project Graveyard는 **버려진 프로젝트들을 기록하고 공유하는 플랫폼**입니다.  
많은 개발자들이 개인 프로젝트나 팀 프로젝트를 시작하지만 여러 이유로 완성하지 못하고 중단합니다.  
그러나 이러한 프로젝트들은 여전히 **아이디어, 코드, 경험**이라는 가치를 가지고 있습니다.

Project Graveyard는 이러한 **중단된 프로젝트를 기록하고, 다른 사람이 이어서 개발할 수 있도록 연결하는 서비스**입니다.

---

# 1. Problem

개발자들은 다음과 같은 문제를 자주 경험합니다.

- 시작했지만 끝내지 못한 프로젝트
- 아이디어는 좋지만 시간이 부족한 프로젝트
- GitHub에 방치된 저장소
- 팀이 해체되어 중단된 프로젝트

이러한 프로젝트들은 대부분 **인터넷 어딘가에 묻혀 사라집니다.**

하지만 이 프로젝트들은 다음과 같은 가치를 가지고 있습니다.

- 새로운 아이디어
- 부분적으로 완성된 코드
- 실패 경험
- 기술적 시도

문제는 **이러한 정보들이 공유되지 않는다는 점입니다.**

---

# 2. Solution

Project Graveyard는 다음 기능을 제공합니다.

### 1. 중단된 프로젝트 기록

사용자는 다음 정보를 기록할 수 있습니다.

- 프로젝트 이름
- 설명
- 사용 기술
- 프로젝트 상태
- 중단 이유
- 배운 점
- GitHub 링크

### 2. 프로젝트 이어서 개발하기 (Adopt)

다른 사용자는 프로젝트를 보고

- 관심 표시
- 이어서 개발하기
- 협업 제안

을 할 수 있습니다.

### 3. 실패 경험 공유

각 프로젝트는 다음 질문에 대한 답을 포함합니다.

- What went wrong?
- What did we learn?
- What would we do differently?

이를 통해 **개발 경험 공유 플랫폼** 역할을 합니다.

---

# 3. Key Features

## 3.1 Project Posting

사용자는 다음 정보를 입력하여 프로젝트를 등록합니다.

- Title
- Description
- Tech Stack
- Project Status
- GitHub Link
- Reason for Abandonment
- Lessons Learned

## 3.2 Project Adoption

사용자는 프로젝트를 이어받을 수 있습니다.

예시:

- This project needs a frontend developer
- Looking for contributors

버튼 예시:

- Adopt Project
- Join Development

## 3.3 Tag System

프로젝트는 다음 태그를 가질 수 있습니다.

- Web
- AI
- Mobile
- Game
- Data Science
- Security
- DevOps

## 3.4 Search and Discovery

사용자는 다양한 기준으로 프로젝트를 탐색할 수 있습니다.

검색 기준

- Tech Stack
- Difficulty
- Category
- Status

## 3.5 Failure Story

각 프로젝트에는 **Failure Story** 섹션이 있습니다.

예시:

Reason for abandonment:  
We underestimated the complexity of real-time synchronization.

Lessons learned:  
Start with a simpler architecture first.

이 기능은 **다른 개발자들에게 학습 자료가 됩니다.**

---

# 4. Example Project Page

Example:

Project: AI Study Planner

Tech Stack  
Python, FastAPI, React

Status  
Abandoned

Reason  
Team members became busy during exam period.

Lessons Learned  
Building a good scheduling algorithm is harder than expected.

GitHub  
github.com/example/studyplanner

Action  
Adopt this project

---

# 5. Tech Stack

## Frontend

- React
- Next.js
- TailwindCSS

## Backend

- FastAPI or Flask
- REST API

## Database

- PostgreSQL

## Authentication

- OAuth (GitHub Login)

## Optional Features

- GitHub API integration
- Project popularity ranking
- Comment system

---

# 6. Architecture

Frontend (React / Next.js)

↓

Backend API (FastAPI / Flask)

↓

Database (PostgreSQL)

Optional integration:

- GitHub API

---

# 7. Future Extensions

Project Graveyard는 다음 방향으로 확장될 수 있습니다.

### GitHub Integration

GitHub abandoned repositories 자동 분석

### AI Project Analyzer

AI가 프로젝트를 분석하여 다음 정보를 제공합니다.

- Project complexity
- Missing components
- Difficulty estimation

### Contributor Matching

사용자 기술 기반 추천

예시:

"You may like these projects."

---

# 8. Expected Impact

Project Graveyard는 다음 문제를 해결합니다.

- 버려지는 프로젝트 문제
- 개발 경험 공유 부족
- 협업 기회 부족

그리고 다음 가치를 제공합니다.

- 지식 공유
- 실패 경험 공유
- 협업 기회 제공

---

# 9. Demo Scenario

데모 흐름

1. 사용자가 프로젝트 등록
2. 다른 사용자가 프로젝트 탐색
3. 프로젝트 이어받기
4. 협업 시작

---

# 10. Target Users

- 대학생 개발자
- 사이드 프로젝트 개발자
- 해커톤 참가자
- 스타트업 팀

---

# 11. Possible Slogans

Every abandoned project deserves a second life.

Your unfinished ideas still matter.

Where failed projects become new beginnings.