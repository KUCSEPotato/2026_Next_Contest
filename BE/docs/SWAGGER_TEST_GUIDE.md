# Devory BE Swagger Test Guide

이 문서는 FastAPI Swagger(`/docs`)에서 API를 직접 검증하기 위한 실전 테스트 순서를 제공합니다.

## 1. 사전 준비

- 서버 실행
  - 작업 디렉터리: `BE`
  - 실행: `uvicorn app.main:app --reload`
- Swagger 접속
  - `http://127.0.0.1:8000/docs`
- 공통 응답 형식
  - 성공: `{ "success": true, "data": ..., "meta": ... }`
  - 실패: `{ "detail": "..." }` (FastAPI HTTPException)

## 2. 인증 토큰 준비 (필수)

아래 1~3 단계를 먼저 수행하세요.

1) POST /api/v1/auth/signup
- body 예시
```json
{
  "email": "user1@example.com",
  "nickname": "user1",
  "password": "password123"
}
```

2) POST /api/v1/auth/login
- body 예시
```json
{
  "login_id": "user1@example.com",
  "password": "password123"
}
```
- `login_id`에는 이메일 또는 닉네임을 넣을 수 있습니다.
- 응답에서 `access_token`, `refresh_token` 확보

3) OAuth 로그인 (선택)
- GitHub OAuth: POST `/api/v1/auth/oauth/github`
```json
{
  "code": "<github_authorization_code>",
  "redirect_uri": "http://127.0.0.1:3000/auth/github/callback",
  "nickname": "user1"
}
```
- Google OAuth: POST `/api/v1/auth/oauth/google`
```json
{
  "code": "<google_authorization_code>",
  "redirect_uri": "http://127.0.0.1:3000/auth/google/callback",
  "nickname": "user1_google"
}
```
- 서버에서 provider와 토큰 교환 및 사용자 정보 검증을 수행합니다.
- 최초 OAuth 로그인 시에는 `nickname`이 없으면 provider 정보 기반으로 자동 생성됩니다.

4) 인증 헤더 사용
- 인증이 필요한 API에서는 헤더에 아래 값을 넣습니다.
  - Header 이름: `authorization`
  - 값: `Bearer <access_token>`

5) OAuth 계정 연결/해제 (선택)
- 연결 상태 조회: GET `/api/v1/auth/oauth/links`
- GitHub 연결: POST `/api/v1/auth/oauth/link/github`
```json
{
  "code": "<github_authorization_code>",
  "redirect_uri": "http://127.0.0.1:3000/auth/github/callback"
}
```
- Google 연결: POST `/api/v1/auth/oauth/link/google`
```json
{
  "code": "<google_authorization_code>",
  "redirect_uri": "http://127.0.0.1:3000/auth/google/callback"
}
```
- GitHub 해제: DELETE `/api/v1/auth/oauth/unlink/github`
- Google 해제: DELETE `/api/v1/auth/oauth/unlink/google`
- 연결 해제 시 로그인 수단이 하나도 남지 않으면 실패합니다.

## 3. 사용자/마이페이지 시나리오

1) GET /api/v1/users/me/profile
2) PATCH /api/v1/users/me/profile
- body 예시
```json
{
  "bio": "FastAPI enthusiast",
  "avatar_url": "https://example.com/avatar.png"
}
```
3) POST /api/v1/users/me/skills
- body 예시
```json
{
  "name": "FastAPI",
  "proficiency": 4
}
```
4) GET /api/v1/users/me/reputation
5) GET /api/v1/users/{user_id}/profile
6) GET /api/v1/users/{user_id}/stats
7) GET /api/v1/users/{user_id}/projects

## 4. 아이디어 시나리오

1) POST /api/v1/ideas
- body 예시
```json
{
  "title": "AI 프로젝트 매칭 플랫폼",
  "description": "팀 구성과 프로젝트 이력을 연결하는 플랫폼",
  "difficulty": "intermediate",
  "summary": "협업 매칭",
  "domain": "web",
  "tech_stack": ["FastAPI", "PostgreSQL", "React"],
  "hashtags": ["#matching", "#teamwork"],
  "required_members": 3,
  "is_open": true
}
```
2) GET /api/v1/ideas
- query 예시: `page=1`, `size=20`, `difficulty=intermediate`
3) GET /api/v1/ideas/{idea_id}
4) PATCH /api/v1/ideas/{idea_id}
- body 예시
```json
{
  "summary": "협업 매칭 + 회고",
  "tech_stack": ["FastAPI", "Redis"],
  "hashtags": ["#matching", "#retrospective"],
  "is_open": false
}
```
5) POST /api/v1/ideas/{idea_id}/bookmark
6) DELETE /api/v1/ideas/{idea_id}/bookmark
7) POST /api/v1/ideas/{idea_id}/like
8) DELETE /api/v1/ideas/{idea_id}/like
9) DELETE /api/v1/ideas/{idea_id}

## 5. 프로젝트 핵심 시나리오

1) POST /api/v1/projects
- body 예시
```json
{
  "title": "Devory MVP",
  "description": "프로젝트 협업 플랫폼 MVP",
  "difficulty": "intermediate",
  "summary": "MVP build",
  "category": "web",
  "status": "planning",
  "progress_percent": 0,
  "is_public": true
}
```
2) GET /api/v1/projects
3) GET /api/v1/projects/{project_id}
4) PATCH /api/v1/projects/{project_id}
- body 예시
```json
{
  "status": "in_progress",
  "progress_percent": 20
}
```
5) PATCH /api/v1/projects/{project_id}/status
- body 예시
```json
{
  "status": "paused"
}
```

## 6. 지원/초대/멤버 시나리오

1) POST /api/v1/projects/{project_id}/applications
- body 예시
```json
{
  "message": "백엔드로 참여하고 싶습니다"
}
```
2) GET /api/v1/projects/{project_id}/applications (리더 계정)
3) PATCH /api/v1/projects/{project_id}/applications/{application_id}
- body 예시
```json
{
  "status": "accepted",
  "role_in_project": "backend"
}
```
4) POST /api/v1/projects/{project_id}/invite
- body 예시
```json
{
  "invitee_id": 2,
  "message": "함께 하시죠"
}
```
5) POST /api/v1/projects/{project_id}/invite/{invite_id}/accept
6) POST /api/v1/projects/{project_id}/invite/{invite_id}/reject
7) POST /api/v1/projects/{project_id}/members
8) DELETE /api/v1/projects/{project_id}/members/{member_id}

## 7. 진행관리/회고/리뷰 시나리오

1) POST /api/v1/projects/{project_id}/milestones
2) PATCH /api/v1/projects/{project_id}/milestones/{milestone_id}
3) GET /api/v1/projects/{project_id}/progress
4) POST /api/v1/projects/{project_id}/todos
5) GET /api/v1/projects/{project_id}/todos
6) PATCH /api/v1/projects/{project_id}/todos/{todo_id}
7) DELETE /api/v1/projects/{project_id}/todos/{todo_id}
8) POST /api/v1/projects/{project_id}/retrospectives
9) GET /api/v1/projects/{project_id}/retrospectives
10) GET /api/v1/projects/{project_id}/retrospectives/{retrospective_id}
11) PATCH /api/v1/projects/{project_id}/retrospectives/{retrospective_id}
12) POST /api/v1/projects/{project_id}/reviews
- body 예시
```json
{
  "reviewee_id": 2,
  "teamwork_score": 5,
  "contribution_score": 4,
  "responsibility_score": 5,
  "comment": "책임감이 뛰어났습니다"
}
```
13) GET /api/v1/projects/{project_id}/reviews

## 8. 실패경험/이어받기 시나리오

1) POST /api/v1/projects/{project_id}/failure-stories
2) GET /api/v1/projects/{project_id}/failure-stories
3) GET /api/v1/projects/failure-stories
4) POST /api/v1/adoptions/projects/{project_id}/request
5) PATCH /api/v1/adoptions/requests/{request_id}
- body 예시
```json
{
  "status": "approved"
}
```

## 9. 검색/추천/구독 시나리오

- Search
  - GET /api/v1/search/projects?q=devory
  - GET /api/v1/search/ideas?q=ai
  - GET /api/v1/search/users?q=user
  - GET /api/v1/search/tags?q=fa

- Matching
  - GET /api/v1/matching/recommend-candidates?limit=5
  - GET /api/v1/matching/recommend-projects?limit=5

- Recommendation
  - POST /api/v1/recommendations/projects
  - POST /api/v1/recommendations/teammates
  - POST /api/v1/recommendations/explain

- Subscription
  - GET /api/v1/subscriptions/plans
  - POST /api/v1/subscriptions/checkout
  - GET /api/v1/subscriptions/me
  - POST /api/v1/subscriptions/cancel

## 10. 채팅/알림/관리자 시나리오

- Chat (프로젝트 멤버만)
  - GET /api/v1/chats/projects/{project_id}/rooms
  - POST /api/v1/chats/projects/{project_id}/rooms
  - GET /api/v1/chats/rooms/{room_id}/messages
  - POST /api/v1/chats/rooms/{room_id}/messages

- Notification
  - GET /api/v1/notifications
  - PATCH /api/v1/notifications/{notification_id}/read

- Admin (role=admin 계정 필요)
  - GET /api/v1/admin/users
  - PATCH /api/v1/admin/users/{user_id}/status
  - GET /api/v1/admin/projects
  - GET /api/v1/admin/reports
  - PATCH /api/v1/admin/reports/{report_id}

## 11. 자주 발생하는 실패 케이스

- 401 Unauthorized
  - Authorization 헤더 누락
  - Bearer 접두어 누락
  - 만료/잘못된 JWT

- 403 Forbidden
  - 프로젝트 리더/멤버 권한 불충족
  - 관리자 권한 API에 일반 사용자 접근

- 404 Not Found
  - 삭제(soft delete)된 리소스 포함 잘못된 ID

- 409 Conflict
  - 중복 이메일/닉네임
  - 중복 북마크/좋아요/지원/리뷰

## 12. 테스트 권장 순서 요약

1) Auth (signup/login/me/refresh)
2) Users
3) Ideas
4) Projects 기본 CRUD
5) Applications/Invites/Members
6) Todo/Retrospective/Review
7) Search/Recommendation/Matching
8) Subscription
9) Chat/Notification
10) Admin
