# Devory API Catalog

이 문서는 BE/app/api 기준의 API 동작을 한 눈에 확인하기 위한 운영 카탈로그입니다.
기본 Prefix는 /api/v1 입니다.

## 공통 규칙

- 인증이 필요한 API는 Authorization 헤더에 Bearer access token 필요
- 공통 성공 응답 형식: {"success": true, "data": ..., "meta": ...}
- 공통 실패 응답 형식: {"detail": "..."}
- Pagination 쿼리는 page/size 형태를 기본 사용

## 1) Auth

- POST /auth/signup: 이메일/닉네임/비밀번호로 계정 생성
- POST /auth/login: login_id(이메일 또는 닉네임) + 비밀번호 로그인
- POST /auth/oauth/github: GitHub authorization code 기반 로그인/가입
- POST /auth/oauth/google: Google authorization code 기반 로그인/가입
- GET /auth/oauth/links: 현재 계정의 OAuth 연결 상태 조회
- POST /auth/oauth/link/github: 현재 계정에 GitHub 연결
- POST /auth/oauth/link/google: 현재 계정에 Google 연결
- DELETE /auth/oauth/unlink/github: 현재 계정에서 GitHub 연결 해제
- DELETE /auth/oauth/unlink/google: 현재 계정에서 Google 연결 해제
- POST /auth/logout: access/refresh 토큰 revoke 처리
- POST /auth/token/refresh: refresh token으로 access token 재발급
- POST /auth/password/forgot: 비밀번호 재설정 토큰 발급
- POST /auth/password/reset: 비밀번호 재설정 적용
- GET /auth/me: 현재 인증 사용자 기본 정보 조회

## 2) Users

- GET /users/me/profile: 내 프로필 + 기술 스택 조회
- PATCH /users/me/profile: 닉네임/소개/아바타 수정
- GET /users/{user_id}/profile: 공개 프로필 조회
- GET /users/{user_id}/stats: 활동 통계 조회
- GET /users/{user_id}/projects: 사용자 프로젝트 이력
- GET /users/me/reviews: **내가 받은 리뷰 목록**(마이페이지용)
- GET /users/me/applications: **내가 지원한 프로젝트 목록**(지원현황 조회)
- POST /users/me/skills: 기술 스택 등록
- DELETE /users/me/skills/{skill_id}: 기술 스택 제거
- POST /users/me/interests: 관심 분야 등록
- DELETE /users/me/interests/{interest_id}: 관심 분야 제거
- GET /users/me/reputation: 리뷰 기반 신뢰도/평점 요약

## 3) Ideas

- POST /ideas: 아이디어 생성(tech_stack, hashtags 포함)
- GET /ideas: 아이디어 목록 조회(필터/페이지네이션)
- GET /ideas/{idea_id}: 아이디어 상세
- PATCH /ideas/{idea_id}: 아이디어 수정(작성자)
- DELETE /ideas/{idea_id}: 아이디어 삭제(soft delete)
- POST /ideas/{idea_id}/bookmark: 북마크 추가
- DELETE /ideas/{idea_id}/bookmark: 북마크 해제
- POST /ideas/{idea_id}/like: 좋아요 추가
- DELETE /ideas/{idea_id}/like: 좋아요 취소
- POST /ideas/{idea_id}/convert-to-project: **아이디어 → 프로젝트 전환**(인원 모임 후 프로젝트화)

## 4) Projects

**두 가지 워크플로우 지원:**
1. **Idea → Project**: 아이디어 등록 후 인원이 모이면 전환 (POST /ideas/{idea_id}/convert-to-project)
2. **Direct Project**: 처음부터 프로젝트 생성하여 기획부터 진행까지 관리

- POST /projects: 프로젝트 생성 + 생성자 리더 등록(max_members: 최대 멤버 수, 기본값 10, idea_id는 선택사항)
- GET /projects: 프로젝트 목록 조회
- GET /projects/{project_id}: 프로젝트 상세 + 멤버(현재 멤버 수, 최대 멤버 수, 경쟁률 포함)
- PATCH /projects/{project_id}: 프로젝트 메타데이터 수정(max_members 수정 가능)
- DELETE /projects/{project_id}: 프로젝트 soft delete
- PATCH /projects/{project_id}/status: 프로젝트 상태 변경

### 지원/초대/멤버
- POST /projects/{project_id}/applications: 프로젝트 지원
- GET /projects/{project_id}/applications: 지원자 목록(리더)
- PATCH /projects/{project_id}/applications/{application_id}: 지원 승인/거절
- POST /projects/{project_id}/invite: 사용자 초대
- POST /projects/{project_id}/invite/{invite_id}/accept: 초대 수락
- POST /projects/{project_id}/invite/{invite_id}/reject: 초대 거절
- POST /projects/{project_id}/members: 멤버 직접 추가
- DELETE /projects/{project_id}/members/{member_id}: 멤버 제거

### 진행 관리
- POST /projects/{project_id}/milestones: 마일스톤 생성
- PATCH /projects/{project_id}/milestones/{milestone_id}: 마일스톤 수정
- GET /projects/{project_id}/progress: Todo 기반 진행률 조회
- POST /projects/{project_id}/recruitments: 재모집 생성
- PATCH /projects/{project_id}/recruitments/{recruitment_id}: 재모집 수정

### Todo/회고/리뷰/실패기록
- POST /projects/{project_id}/todos: Todo 생성
- GET /projects/{project_id}/todos: Todo 목록(stage, assignments 포함)
- PATCH /projects/{project_id}/todos/{todo_id}: Todo 수정(배정/단계 포함)
- PATCH /projects/{project_id}/todos/{todo_id}/done: 현재 사용자 할당분 완료 토글
- DELETE /projects/{project_id}/todos/{todo_id}: Todo 삭제
- WS /projects/{project_id}/todos/ws: Todo 실시간 구독(생성/수정/삭제/완료 이벤트)
- POST /projects/{project_id}/retrospectives: 회고 작성
- GET /projects/{project_id}/retrospectives: 회고 목록
- GET /projects/{project_id}/retrospectives/{retrospective_id}: 회고 상세
- PATCH /projects/{project_id}/retrospectives/{retrospective_id}: 회고 수정
- POST /projects/{project_id}/failure-stories: 실패 경험 등록
- GET /projects/{project_id}/failure-stories: 프로젝트 실패 경험 조회
- GET /projects/failure-stories: 공개 실패 경험 통합 조회
- POST /projects/{project_id}/reviews: 프로젝트 리뷰 작성
- GET /projects/{project_id}/reviews: 프로젝트 리뷰 목록

## 5) Matching

- GET /matching/recommend-candidates: 후보 인재 추천
- GET /matching/recommend-projects: 추천 프로젝트 조회

## 6) Adoptions

- POST /adoptions/projects/{project_id}/request: 프로젝트 이어받기 요청
- PATCH /adoptions/requests/{request_id}: 이어받기 승인/거절/취소 처리

## 7) Reviews

- POST /reviews/projects/{project_id}: 프로젝트 컨텍스트 리뷰 작성
- GET /reviews/projects/{project_id}: 프로젝트 리뷰 목록(reviewer/reviewee/scores/comment 포함)
- GET /reviews/users/{user_id}: 사용자 수신 리뷰 목록(reviewer 정보/프로젝트 정보 포함)
- GET /reviews/users/{user_id}/rating: 사용자 평점 집계 조회

## 8) Search

- GET /search/projects: 프로젝트 검색
- GET /search/ideas: 아이디어 검색
- GET /search/users: 사용자 검색
- GET /search/tags: 태그 자동완성

## 9) Subscriptions

- GET /subscriptions/plans: 활성 플랜 목록
- POST /subscriptions/checkout: 구독 생성(체크아웃)
- POST /subscriptions/webhook: 결제 이벤트 수신
- GET /subscriptions/me: 내 구독 상태 조회
- POST /subscriptions/cancel: 구독 해지

## 10) Recommendations

- POST /recommendations/projects: 프로젝트 추천
- POST /recommendations/teammates: 팀원 추천
- POST /recommendations/explain: 추천 사유 자연어 설명

## 11) Chats

- GET /chats/projects/{project_id}/rooms: 프로젝트 채팅방 목록
- POST /chats/projects/{project_id}/rooms: 채팅방 생성
- GET /chats/rooms/{room_id}/messages: 메시지 목록 조회
- POST /chats/rooms/{room_id}/messages: 메시지 전송
- WS /chats/projects/{project_id}/rooms/{room_id}/ws: 채팅 메시지 실시간 송수신/구독

## 12) Community (커뮤니티 게시판)

### 게시물
- POST /community: 새 게시물 작성
- GET /community: 게시물 목록 조회(카테고리 필터, 페이지네이션, 핀 우선)
- GET /community/{post_id}: 게시물 상세(조회수 자동 증가, 반응 통계 포함)
- PATCH /community/{post_id}: 게시물 수정(작성자만)
- DELETE /community/{post_id}: 게시물 삭제(소프트 삭제)

### 댓글(중첩 댓글/대댓글 지원)
- POST /community/{post_id}/comments: 댓글 작성
- GET /community/{post_id}/comments: 댓글 목록 조회(페이지네이션)
- PATCH /community/{post_id}/comments/{comment_id}: 댓글 수정(작성자만)
- DELETE /community/{post_id}/comments/{comment_id}: 댓글 삭제(소프트 삭제)

### 반응(게시물/댓글에 like, interested, helpful, curious)
- POST /community/{post_id}/reactions: 게시물 반응 추가/토글
- POST /community/{post_id}/comments/{comment_id}/reactions: 댓글 반응 추가/토글

## 13) Notifications

- GET /notifications: 알림 목록
- PATCH /notifications/{notification_id}/read: 읽음 처리

## 14) Admin

- GET /admin/users: 전체 사용자 목록 조회(관리자)
- PATCH /admin/users/{user_id}/status: 사용자 상태/역할 변경(관리자)
- GET /admin/projects: 전체 프로젝트 목록 조회(관리자)
- GET /admin/reports: 신고 목록 조회(관리자)
- PATCH /admin/reports/{report_id}: 신고 처리 상태 변경(관리자)

## 참고 문서

- BE/docs/SWAGGER_TEST_GUIDE.md
- BE/docs/API_PLAN.md
- BE/docs/db/01_postgresql_schema.sql
