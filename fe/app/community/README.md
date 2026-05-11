# 커뮤니티 게시판 (Community)

## 개요

자유게시판 기능을 제공하는 페이지입니다. 카카오스토리 스타일의 피드형 UI로 구성되어 있으며, BE REST API와 연동되어 있습니다.

---

## 파일 구조

```
fe/app/community/
├── page.tsx                  # 게시물 목록 (피드/목록 탭)
├── new/
│   └── page.tsx              # 게시물 작성 페이지
├── [postId]/
│   └── page.tsx              # 게시물 상세 + 댓글
├── _types/
│   └── index.ts              # 공통 타입 정의
├── _lib/
│   ├── api.ts                # BE API 호출 함수 모음
│   └── utils.ts              # 유틸 함수 (timeAgo, 댓글 트리 등)
└── _components/
    ├── Avatar.tsx             # 유저 아바타
    ├── CommentItem.tsx        # 댓글/대댓글 컴포넌트
    ├── LoginModal.tsx         # 비로그인 모달
    ├── MediaPreview.tsx       # 미디어 미리보기
    └── PostCard.tsx           # 게시물 카드 (피드용)
```

---

## 라우팅

| 경로 | 설명 |
|---|---|
| `/community` | 게시물 목록 (피드/목록 탭 전환) |
| `/community/new` | 게시물 작성 |
| `/community/{postId}` | 게시물 상세 + 댓글 |

---

## BE API 연동

### Base URL

```ts
// fe/app/community/_lib/api.ts
const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/v1/community`;
```

### 엔드포인트

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/community` | 게시물 목록 (카테고리 필터, 페이지네이션) |
| GET | `/api/v1/community/{post_id}` | 게시물 상세 (조회수 증가, 반응 통계) |
| POST | `/api/v1/community` | 게시물 작성 |
| PATCH | `/api/v1/community/{post_id}` | 게시물 수정 (작성자만) |
| DELETE | `/api/v1/community/{post_id}` | 게시물 삭제 (소프트 삭제) |
| POST | `/api/v1/community/{post_id}/reactions` | 게시물 반응 추가/토글 |
| GET | `/api/v1/community/{post_id}/comments` | 댓글 목록 |
| POST | `/api/v1/community/{post_id}/comments` | 댓글/대댓글 작성 |
| PATCH | `/api/v1/community/{post_id}/comments/{comment_id}` | 댓글 수정 |
| DELETE | `/api/v1/community/{post_id}/comments/{comment_id}` | 댓글 삭제 |
| POST | `/api/v1/community/{post_id}/comments/{comment_id}/reactions` | 댓글 반응 추가/토글 |

### 인증

모든 쓰기 API는 `Authorization: Bearer {access_token}` 헤더가 필요합니다.
토큰은 `localStorage.getItem("access_token")`에서 가져옵니다.

---

## 유저 정보

로그인 후 `/auth/me` API를 호출해 유저 정보를 `localStorage`의 `"user"` 키에 저장합니다.

```ts
localStorage.setItem("user", JSON.stringify(me.data));
```

커뮤니티 페이지에서는 이 값을 읽어 `currentUser` 상태로 사용합니다.

---

## 반응 타입

게시물/댓글 모두 아래 4가지 반응을 지원합니다.

| 타입 | 이모지 |
|---|---|
| `like` | ❤️ |
| `interested` | 🤔 |
| `helpful` | 👍 |
| `curious` | 🧐 |

---

## 미디어 업로드

현재 UI는 구현되어 있으나 **BE API 미완성으로 실제 저장은 되지 않습니다.**

BE에서 아래 API 완성 후 연동 예정입니다.

```
POST /api/v1/community/media/upload
Content-Type: multipart/form-data
```

연동 시 `fe/app/community/new/page.tsx` 내 `TODO` 주석 부분을 활성화하면 됩니다.

```ts
// TODO: BE 미디어 업로드 API 완성 후 아래 주석 해제
// const url = await uploadMediaFile(media[i].file);
// media_urls: mediaUrls,
```

---

## 제한 사항

- 파일 첨부 최대 **10개**
- 파일 크기 최대 **50MB**
- 허용 형식: 이미지(`image/*`), 동영상(`video/*`)

---

## 비로그인 처리

비로그인 상태에서 아래 동작 시 로그인 모달이 노출됩니다.

- 게시물 작성
- 좋아요/반응
- 댓글 작성
- 대댓글 작성

---

## TODO

- [ ] 미디어 업로드 API 연동 (BE 완성 후)
- [ ] `/auth/me` API로 유저 정보 조회 (현재 `localStorage.getItem("user")` 사용)
- [ ] 댓글 대댓글 무한 로드 (현재 작성 직후 로컬에서만 표시)
- [ ] 게시물 목록 무한 스크롤 (현재 페이지네이션)
