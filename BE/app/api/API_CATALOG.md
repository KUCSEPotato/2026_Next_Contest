# Devory API Catalog

이 문서는 BE/app/api 기준의 API 동작을 한 눈에 확인하기 위한 운영 카탈로그입니다.
기본 Prefix는 /api/v1 입니다.

## 공통 규칙

- 인증이 필요한 API는 Authorization 헤더에 Bearer access token 필요
- 공통 성공 응답 형식: {"success": true, "data": ..., "meta": ...}
- 공통 실패 응답 형식: {"detail": "..."}
- Pagination 쿼리는 page/size 형태를 기본 사용

## 1) Auth

- POST /auth/signup: 이메일/아이디/이름/전화번호/비밀번호로 계정 생성 + 온보딩 토큰 발급
- POST /auth/login: login_id(이메일 또는 닉네임) + 비밀번호 로그인
- 응답 일부에 `coin_balance`가 포함됩니다.
- POST /auth/oauth/github: GitHub authorization code 기반 로그인/가입
  - 이미 `github_id`로 연결된 계정이 있으면 즉시 로그인 토큰 발급
  - 신규 GitHub 사용자면 새 계정 생성 후 access/refresh token 발급
  - GitHub 이메일이 기존 계정과 일치하지만 아직 GitHub가 연결되지 않은 경우 자동 연결하지 않고 아래 형태로 확인 응답 반환
    - `requires_link_confirmation=true`
    - `provider="github"`
    - `email`
    - `nickname`
    - `link_token`
    - `expires_in`(기본 10분)
- POST /auth/oauth/link-existing/github: 기존 이메일 계정에 GitHub 연결 확정
  - body: `{ "link_token": "..." }`
  - `link_token`이 유효하고 GitHub 계정이 다른 사용자에게 연결되어 있지 않으면 기존 계정에 `github_id` 저장
  - 성공 시 access/refresh token, `user`, `linked_provider="github"` 반환
  - 만료/위조 토큰이면 `400`, 이미 다른 사용자에게 연결된 GitHub 계정이면 `409`
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
- GET /auth/me: 현재 인증 사용자 기본 정보 조회(온보딩 상태 포함)

## 2) Users

- GET /users/me/profile: 내 프로필 + 기술 스택 + 선택한 아이디어 조회
  - S3 아바타는 `avatar_s3_key`를 기반으로 매 응답마다 presigned GET URL을 `avatar_url`로 반환합니다.
- GET /users/me/onboarding: 회원가입/프로필/아이디어 선택 상태 조회
- PATCH /users/me/profile: 닉네임/이름/전화번호/소개/아바타 수정
- POST /users/me/avatar: 아바타(프로필 사진) 파일 업로드 (multipart/form-data, private S3에 저장)
  - DB에는 presigned URL이 아니라 `avatar_s3_key`만 저장합니다.
  - 응답의 `avatar_url`은 만료 시간이 있는 presigned GET URL입니다.
- GET /users/{user_id}/profile: 공개 프로필 조회
- GET /users/{user_id}/stats: 활동 통계 조회
- GET /users/{user_id}/projects: 사용자 프로젝트 이력
- GET /users/{user_id}/reviews: **공개 리뷰 조회** (인증 불필요, 평점과 코멘트 포함)
- GET /users/me/reviews: **내가 받은 리뷰 목록**(마이페이지용, `comment`와 호환용 `message` 포함)
- GET /users/me/applications: **내가 지원한 프로젝트 목록**(지원현황 조회)
- POST /users/me/skills: 기술 스택 등록
- DELETE /users/me/skills/{skill_id}: 기술 스택 제거
- POST /users/me/interests: 관심 분야 등록
- DELETE /users/me/interests/{interest_id}: 관심 분야 제거
- 프로젝트 생성/시작/완료/재활용 시 코인 보상 이력이 누적됩니다.
- POST /users/me/onboarding/ideas: 온보딩 마지막 단계에서 관심 아이디어 선택 및 가입 완료 처리
- GET /users/me/reputation: 리뷰 기반 신뢰도/평점 요약(`score`, 항목별 평균 포함)

## 3) Ideas

**아이디어 상태 흐름:**
- 일반 아이디어는 생성 시 즉시 프로젝트로 연결됩니다.
- 프로젝트가 `/projects/{project_id}/revert-to-idea`로 되돌려지면 원본 아이디어는 `is_discarded=true`, `converted_to_project_id=null` 상태가 됩니다.
- discarded 아이디어는 영감의 샘에서 타인이 `/ideas/{idea_id}/pickup`으로 새 프로젝트로 재활용할 수 있습니다.

- POST /ideas: 아이디어 생성 + 프로젝트 자동 생성(tech_stack, hashtags 포함)
- GET /ideas: 아이디어 목록 조회(필터/페이지네이션)
  - query: `page`, `size`, `difficulty`, `discarded`
  - `discarded=true`: 영감의 샘에 버려진 아이디어만 조회
  - `discarded=false`: 버려지지 않은 아이디어만 조회
  - `discarded` 미지정: 전체 아이디어 조회
- GET /ideas/{idea_id}: 아이디어 상세
- POST /ideas/{idea_id}/files: 아이디어 파일 업로드 (multipart/form-data)
- GET /ideas/{idea_id}/files: 아이디어 첨부 파일 목록 조회
- DELETE /ideas/{idea_id}/files/{file_id}: 아이디어 첨부 파일 삭제 (소프트 삭제 + S3 삭제)
- POST /admin/projects/stale-reminders/run: 30일 이상 시작되지 않은 프로젝트에 알림 생성 배치 실행
- PATCH /ideas/{idea_id}: 아이디어 수정(작성자)
- DELETE /ideas/{idea_id}: 아이디어 삭제(soft delete)
- POST /ideas/{idea_id}/bookmark: 북마크 추가
- DELETE /ideas/{idea_id}/bookmark: 북마크 해제
- POST /ideas/{idea_id}/like: 좋아요 추가
- DELETE /ideas/{idea_id}/like: 좋아요 취소
- POST /ideas/{idea_id}/convert-to-project: **아이디어 → 프로젝트 전환**(인원 모임 후 프로젝트화)
- POST /ideas/{idea_id}/pickup: **버려진 아이디어 줍기**(영감의 샘 전용)
  - 인증 필요
  - `is_discarded=true`인 아이디어만 가능
  - 이미 `converted_to_project_id`가 있으면 불가
  - 원작성자는 자기 아이디어를 다시 주울 수 없음
  - 성공 시 새 Project 생성, 현재 사용자를 leader로 ProjectMember 등록, `converted_to_project_id` 연결, `is_discarded=false` 처리

## 4) Projects

**세 가지 워크플로우 지원:**
1. **Auto Project from Idea**: 아이디어 등록 시 즉시 프로젝트도 생성
2. **Direct Project**: 처음부터 프로젝트 생성하여 기획부터 진행까지 관리
3. **Pickup Discarded Idea**: 영감의 샘에 버려진 아이디어를 타인이 새 프로젝트로 이어받음

- POST /projects: 직접 프로젝트 생성 + 생성자 리더 등록(max_members: 리더 포함 최대 멤버 수, 기본값 10, idea_id는 선택사항)
- GET /projects: 프로젝트 목록 조회
  - 응답에 `applicantCount`, `remainingSeats`, `competitionRatio`, `created_at` 포함
  - `competitionRatio`는 `대기 중 지원자 수(applicantCount) / 남은 자리 수(remainingSeats)` 기준
- GET /projects/{project_id}: 프로젝트 상세 + 멤버(현재 멤버 수, 최대 멤버 수, 경쟁률 포함)
  - `members` 항목은 `user_id`, `role_in_project`, `nickname`, `name`, `avatar_url`, `user` 객체를 포함합니다.
  - `user` 객체 형식: `{ id, nickname, name, avatar_url }`
- PATCH /projects/{project_id}: 프로젝트 메타데이터 수정(max_members 수정 가능)
- DELETE /projects/{project_id}: 프로젝트 soft delete
- PATCH /projects/{project_id}/status: 프로젝트 상태 변경
- POST /projects/{project_id}/revert-to-idea: **프로젝트 → 아이디어 복원**(프로젝트 실패 시 원본 아이디어로 되돌리기)

### 참고
- 아이디어 등록 시 backend가 자동으로 프로젝트를 생성하므로, 일반 사용자 입장에서는 `POST /ideas`가 사실상 프로젝트 시작 버튼 역할을 합니다.
- 프로젝트를 영감의 샘으로 보내는 흐름은 `POST /projects/{project_id}/revert-to-idea`가 담당하고, 영감의 샘에서 다시 프로젝트화하는 흐름은 `POST /ideas/{idea_id}/pickup`이 담당합니다.

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
- POST /projects/{project_id}/todos/ai-generate: 팀장 전용 AI Todo 생성
  - Request: `{ "room_id": 1, "message_ids": [10, 11], "limit": 14 }`
  - `message_ids`가 있으면 선택한 채팅만, 없으면 최근 채팅과 프로젝트 상세를 반영합니다.
  - Gemini 미설정 시에도 기본 Todo를 생성합니다.
- GET /projects/{project_id}/todos: Todo 목록(stage, assignments 포함, priority 순 정렬)
- PATCH /projects/{project_id}/todos/{todo_id}: Todo 수정(제목/설명/배정/단계/priority 포함)
- PATCH /projects/{project_id}/todos/{todo_id}/done: 프로젝트 멤버가 Todo 완료/미완료 토글
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

- POST /recommendations/projects: 프로젝트 추천(로그인 사용자 기술 스택 기반 매칭 우선 정렬)
- POST /recommendations/teammates: 팀원 추천
- POST /recommendations/explain: 추천 사유 자연어 설명

## 11) Chats

- GET /chats/projects/{project_id}/rooms: 프로젝트 채팅방 목록
- POST /chats/projects/{project_id}/rooms: 채팅방 생성 (프로젝트 리더만, member_ids로 참여자 선택)
  - Request: `{ "name": "room_name", "member_ids": [1, 2, 3] }`
  - 검증: 리더권한, in_progress 상태, member_ids는 모두 프로젝트 멤버여야 함
- GET /chats/rooms/{room_id}/messages: 메시지 목록 조회 (ChatRoomMember만 접근 가능)
- POST /chats/rooms/{room_id}/messages: 메시지 전송 (ChatRoomMember만 가능)
- GET /chats/my/rooms: 현재 사용자가 속한 채팅방 목록 (최신 메시지 정보 포함)
- WS /chats/projects/{project_id}/rooms/{room_id}/ws: 채팅 메시지 실시간 송수신 (ChatRoomMember만)

## 12) Community (커뮤니티 게시판)

### 게시물
- POST /community: 새 게시물 작성
- GET /community: 게시물 목록 조회
  - 파라미터: `category`, `page`, `page_size`, `sort_by` (newest|views|likes|comments|trending)
  - `sort_by` 옵션:
    - `newest` (기본값): 최신순
    - `views`: 조회수 순
    - `likes`: 추천 순
    - `comments`: 댓글 순
    - `trending` 또는 `hot`: 핫게 (조회수×0.1 + 추천 + 댓글×0.5)
  - 핀 된 글은 항상 상단에 표시
- GET /community/{post_id}: 게시물 상세(조회수 자동 증가, 반응 통계 포함)
- PATCH /community/{post_id}: 게시물 수정(작성자만)
- DELETE /community/{post_id}: 게시물 삭제(소프트 삭제)
 - POST /community/{post_id}/files: 게시물 첨부 파일 업로드 (multipart/form-data, 최대 50MB)
 - GET /community/{post_id}/files: 게시물 첨부 파일 목록 조회
 - DELETE /community/{post_id}/files/{file_id}: 게시물 첨부 파일 삭제 (소프트 삭제 + S3 삭제)

### 댓글(중첩 댓글/대댓글 지원)
- POST /community/{post_id}/comments: 댓글 작성
- GET /community/{post_id}/comments: 댓글 목록 조회(페이지네이션)
- PATCH /community/{post_id}/comments/{comment_id}: 댓글 수정(작성자만)
- DELETE /community/{post_id}/comments/{comment_id}: 댓글 삭제(소프트 삭제)

### 반응(게시물/댓글에 recommend, not_recommend)
- POST /community/{post_id}/reactions: 게시물 반응 추가/토글
- POST /community/{post_id}/comments/{comment_id}/reactions: 댓글 반응 추가/토글

## 13) Notifications

- GET /notifications: 현재 사용자의 알림 목록
  - 응답에 `data`, `project_id`, `url` 포함
  - 프론트는 `url` 또는 `project_id`를 사용해 알림 클릭 시 관련 상세 화면으로 이동
- PATCH /notifications/{notification_id}/read: 읽음 처리(`is_read=true`, `read_at` 기록)

### 알림 생성 지점
- 프로젝트 등록: 프로젝트 생성자에게 `project_update` 알림 생성, `/projects/{project_id}`로 이동
- 프로젝트 지원: 프로젝트 리더에게 `application_received` 알림 생성, `/projects/{project_id}`로 이동
- 지원 승인/거절: 지원자에게 `application_decided` 알림 생성, `/projects/{project_id}`로 이동
- 프로젝트 리뷰 작성: 리뷰 대상자에게 `review_received` 알림 생성, `/projects/{project_id}`로 이동
- 커뮤니티 댓글 작성: 게시글 작성자에게 `system` 알림 생성, `/community/{post_id}`로 이동

## 14) Admin

- GET /admin/overview: 운영 요약 지표(사용자/프로젝트/미처리 신고/결제 이벤트/활성 구독)
- GET /admin/users: 전체 사용자 목록 조회(관리자)
  - query: `q`(이메일/닉네임 검색), `role`, `is_active`
- POST /admin/users/{user_id}/coins: 사용자 코인 수동 지급
- PATCH /admin/users/{user_id}/status: 사용자 상태/역할 변경(관리자)
- GET /admin/projects: 전체 프로젝트 목록 조회(관리자)
- GET /admin/reports: 신고 목록 조회(관리자)
  - query: `scope=all|user|project|post|chat`
- PATCH /admin/reports/{report_id}: 신고 처리 상태 변경(관리자)
- POST /admin/notices: 공지글 작성(커뮤니티 `announcement` 게시글 생성)
- GET /admin/payments: 결제 이벤트 목록 조회(관리자)
- PATCH /admin/payments/{event_id}: 결제 이벤트 처리/해제(관리자)

## 참고 문서

- BE/docs/SWAGGER_TEST_GUIDE.md
- BE/docs/API_PLAN.md
- BE/docs/db/01_postgresql_schema.sql
