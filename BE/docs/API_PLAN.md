# Devory BE API Plan (v1)

## 1) 범위
본 문서는 Project_Plan.md의 10개 핵심 기능을 기반으로 백엔드 API를 도메인 단위로 정의한다.

- Base URL: `/api/v1`
- 인증: JWT Access + Refresh Token (Bearer)
- 권한: `guest`, `user`, `leader`, `admin`
- 공통 응답 규칙:
  - 성공: `{ "success": true, "data": ..., "meta": ... }`
  - 실패: `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`

## 2) 도메인별 API 목록

### A. Auth / Account
- `POST /auth/signup` 회원가입
- `POST /auth/login` 로그인 (email/password)
- `POST /auth/oauth/github` GitHub OAuth 로그인
- `POST /auth/logout` 로그아웃
- `POST /auth/token/refresh` Access Token 재발급
- `POST /auth/password/forgot` 비밀번호 재설정 메일 요청
- `POST /auth/password/reset` 비밀번호 재설정
- `GET /auth/me` 내 인증 정보 조회

### B. Users / MyPage
- `GET /users/me/profile` 내 프로필 조회
- `PATCH /users/me/profile` 내 프로필 수정
- `GET /users/{user_id}/profile` 공개 프로필 조회
- `GET /users/{user_id}/stats` 사용자 활동 통계 (참여/완료/리뷰 요약)
- `GET /users/{user_id}/projects` 사용자 프로젝트 이력
- `POST /users/me/skills` 기술 스택 추가
- `DELETE /users/me/skills/{skill_id}` 기술 스택 삭제
- `GET /users/me/reputation` 신뢰도/평점 조회

### C. Idea Posting
- `POST /ideas` 아이디어 생성
- `GET /ideas` 아이디어 목록/필터/정렬
- `GET /ideas/{idea_id}` 아이디어 상세
- `PATCH /ideas/{idea_id}` 아이디어 수정
- `DELETE /ideas/{idea_id}` 아이디어 삭제
- `POST /ideas/{idea_id}/bookmark` 아이디어 북마크
- `DELETE /ideas/{idea_id}/bookmark` 북마크 해제
- `POST /ideas/{idea_id}/like` 아이디어 좋아요
- `DELETE /ideas/{idea_id}/like` 좋아요 취소

### D. Team Matching / Application
- `POST /projects/{project_id}/applications` 프로젝트 지원
- `GET /projects/{project_id}/applications` 지원자 목록 (리더)
- `PATCH /projects/{project_id}/applications/{application_id}` 지원 승인/거절
- `POST /projects/{project_id}/invite` 리더가 사용자 초대
- `POST /projects/{project_id}/invite/{invite_id}/accept` 초대 수락
- `POST /projects/{project_id}/invite/{invite_id}/reject` 초대 거절
- `GET /matching/recommend-candidates` 프로젝트 기반 추천 인재
- `GET /matching/recommend-projects` 사용자 기반 추천 프로젝트

### E. Projects / Tracking / Team
- `POST /projects` 프로젝트 생성
- `GET /projects` 프로젝트 목록/검색
- `GET /projects/{project_id}` 프로젝트 상세
- `PATCH /projects/{project_id}` 프로젝트 수정
- `DELETE /projects/{project_id}` 프로젝트 삭제
- `POST /projects/{project_id}/members` 멤버 직접 추가
- `DELETE /projects/{project_id}/members/{member_id}` 멤버 제외
- `PATCH /projects/{project_id}/status` 상태 변경 (planning/in-progress/completed/paused)
- `POST /projects/{project_id}/milestones` 마일스톤 생성
- `PATCH /projects/{project_id}/milestones/{milestone_id}` 마일스톤 수정
- `GET /projects/{project_id}/progress` 진행률 조회
- `POST /projects/{project_id}/recruitments` 이탈 포지션 재모집 생성
- `PATCH /projects/{project_id}/recruitments/{recruitment_id}` 재모집 상태 변경

### F. Todo / Retrospective
- `POST /projects/{project_id}/todos` Todo 생성
- `GET /projects/{project_id}/todos` Todo 목록
- `PATCH /projects/{project_id}/todos/{todo_id}` Todo 수정/상태변경
- `DELETE /projects/{project_id}/todos/{todo_id}` Todo 삭제
- `POST /projects/{project_id}/retrospectives` 회고 작성
- `GET /projects/{project_id}/retrospectives` 회고 목록
- `GET /projects/{project_id}/retrospectives/{retrospective_id}` 회고 상세
- `PATCH /projects/{project_id}/retrospectives/{retrospective_id}` 회고 수정

### G. Project Adoption / Failure Story
- `POST /adoptions/projects/{project_id}/request` 이어받기 요청
- `PATCH /adoptions/requests/{request_id}` 이어받기 승인/거절
- `POST /projects/{project_id}/failure-stories` 실패 경험 등록
- `GET /projects/{project_id}/failure-stories` 실패 경험 목록
- `GET /failure-stories` 실패 경험 통합 탐색

### H. Review / Rating
- `POST /projects/{project_id}/reviews` 팀원 평가 작성
- `GET /projects/{project_id}/reviews` 프로젝트 리뷰 목록
- `GET /users/{user_id}/reviews` 사용자 리뷰 목록
- `GET /users/{user_id}/rating` 사용자 평점 집계

### I. Search / Discovery
- `GET /search/projects` 프로젝트 검색
- `GET /search/ideas` 아이디어 검색
- `GET /search/users` 사용자 검색
- `GET /search/tags` 태그 자동완성

### J. Subscription / Billing
- `GET /subscriptions/plans` 플랜 목록
- `POST /subscriptions/checkout` 구독 결제 세션 생성
- `POST /subscriptions/webhook` 결제사 웹훅 수신
- `GET /subscriptions/me` 내 구독 상태 조회
- `POST /subscriptions/cancel` 구독 해지

### K. LLM Recommendation
- `POST /recommendations/projects` 사용자 맞춤 프로젝트 추천 + 추천 이유
- `POST /recommendations/teammates` 프로젝트 맞춤 팀원 추천 + 추천 이유
- `POST /recommendations/explain` 추천 설명 생성/재생성

### L. Chat / Notification
- `GET /projects/{project_id}/chats/rooms` 채팅방 목록
- `POST /projects/{project_id}/chats/rooms` 채팅방 생성
- `GET /chats/rooms/{room_id}/messages` 메시지 목록
- `POST /chats/rooms/{room_id}/messages` 메시지 전송 (REST fallback)
- `GET /notifications` 알림 목록
- `PATCH /notifications/{notification_id}/read` 알림 읽음 처리

### M. Admin
- `GET /admin/users` 사용자 관리 목록
- `PATCH /admin/users/{user_id}/status` 사용자 제재/복구
- `GET /admin/projects` 프로젝트 모니터링 목록
- `GET /admin/reports` 신고 목록
- `PATCH /admin/reports/{report_id}` 신고 처리

## 3) MVP 우선순위
1. Auth/Users/MyPage
2. Ideas + Projects + Applications
3. Todo + Tracking + Reviews
4. Search
5. Subscription
6. Recommendation/Adoption/Failure Story

## 4) 데이터 모델 초안 (핵심)
- User, Skill, UserSkill
- Idea, IdeaBookmark, IdeaLike
- Project, ProjectMember, ProjectMilestone, ProjectRecruitment
- Application, Invitation
- Todo, Retrospective
- AdoptionRequest, FailureStory
- Review, RatingAggregate
- Subscription, PaymentEvent
- ChatRoom, ChatMessage, Notification

## 5) 비기능 요구사항
- Pagination: `page`, `size`, `sort`
- Filter: skill, difficulty, category, status
- Audit: 생성/수정자, 타임스탬프
- Observability: request id, structured logging
- Rate limiting: auth/recommendation endpoint 우선 적용
