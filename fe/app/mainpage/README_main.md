# Devory — 메인 페이지 (프론트엔드)

> 사용자가 서비스에 처음 진입했을 때 AI 추천 프로젝트를 바로 발견하고 참여까지 이어지는 메인 화면입니다.

---

## 목차

1. [개요](#개요)
2. [현재 상태 — 목업 vs 실제](#현재-상태--목업-vs-실제)
3. [화면 구성](#화면-구성)
4. [파일 위치](#파일-위치)
5. [하드코딩 / 목업 데이터 상세](#하드코딩--목업-데이터-상세)
6. [백엔드 연동 가이드](#백엔드-연동-가이드)
7. [TODO](#todo)

---

## 개요

Devory 메인 페이지 프론트엔드 코드입니다.

- 로그인 여부에 따라 네비게이션 바와 추천 섹션이 다르게 표시됩니다.
- 비로그인 사용자가 참여하기 / 아이디어 등록 클릭 시 로그인 유도 모달이 표시됩니다.
- 현재 프로젝트 데이터와 로그인 상태는 **목업/하드코딩**으로 동작합니다.

---

## 현재 상태 — 목업 vs 실제

| 기능 | 현재 상태 | 백엔드 연동 후 |
|------|-----------|----------------|
| 로그인 상태 | `isLoggedIn = false` 하드코딩 | `useSession()` 으로 교체 |
| 프로젝트 목록 | `MOCK_PROJECTS` 배열 (6개 고정) | `GET /api/projects` 호출 결과로 교체 |
| AI 추천 프로젝트 | 목업 데이터 전체 노출 | `GET /api/projects/recommend` 호출 결과로 교체 |
| 검색 | 프론트에서 목업 데이터 필터링 | `GET /api/projects?q=키워드` 호출로 교체 |
| 분야 필터 | 프론트에서 목업 데이터 필터링 | `GET /api/projects?category=분야` 호출로 교체 |
| 알림 🔔 | 빨간 점만 표시 (더미) | 실제 알림 API 연동 |
| 마감 임박 뱃지 | `isUrgent` 필드 하드코딩 | 마감일 기준 서버에서 계산 |
| 참여하기 버튼 | 로그인 유도 모달만 표시 | 실제 지원 API 연동 |

---

## 화면 구성

```
┌─────────────────────────────────────────┐
│ 네비게이션 바                             │
│ 로고 | 검색창 | 로그인/회원가입 (비로그인) │
│ 로고 | 검색창 | 🔔 | 마이페이지 (로그인)  │
├─────────────────────────────────────────┤
│ 히어로 영역                               │
│ 타이틀 + 설명 + 분야 태그 빠른 선택       │
├─────────────────────────────────────────┤
│ AI 추천 프로젝트 (가로 스크롤 카드)        │
│ 비로그인 → "인기 프로젝트"로 표시          │
│ 로그인 → "OOO님을 위한 추천"으로 표시     │
├─────────────────────────────────────────┤
│ 전체 프로젝트 그리드                       │
│ 검색어/분야 선택 시 실시간 필터링           │
├─────────────────────────────────────────┤
│ 아이디어 등록 배너                         │
│ 비로그인 클릭 시 로그인 유도 모달 표시      │
└─────────────────────────────────────────┘
```

---

## 파일 위치

```
fe/
└── app/
    └── main/
        └── page.tsx    ← 메인 페이지 전체
```

---

## 하드코딩 / 목업 데이터 상세

### 1. 로그인 상태 — 하드코딩

현재 로그인 상태가 `false`로 고정되어 있습니다.

```ts
// page.tsx 내 useAuth 함수
const useAuth = () => {
  const [isLoggedIn] = useState(false)  // ← 하드코딩
  const userName = isLoggedIn ? '정민' : null
  return { isLoggedIn, userName }
}
```

로그인 상태에 따라 아래가 바뀝니다.
- 네비게이션 바: 로그인/회원가입 버튼 ↔ 마이페이지 + 알림
- AI 추천 섹션 제목: "인기 프로젝트" ↔ "OOO님을 위한 추천"
- 참여하기 클릭 시: 로그인 유도 모달 표시 ↔ 바로 프로젝트 상세로 이동

---

### 2. 프로젝트 목록 — 목업 데이터

현재 프로젝트 6개가 파일 상단 `MOCK_PROJECTS` 배열에 하드코딩되어 있습니다.

```ts
const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'AI 코드 리뷰 봇',
    category: 'AI/데이터',
    techStack: ['Python', 'FastAPI', 'OpenAI'],
    currentMembers: 2,
    maxMembers: 4,
    daysLeft: 3,
    difficulty: 'intermediate',
    isUrgent: true,      // ← 마감 임박 뱃지 여부 하드코딩
  },
  // ... 총 6개
]
```

---

### 3. 검색 / 필터 — 프론트 필터링

현재 검색과 분야 필터는 API 호출 없이 `MOCK_PROJECTS`를 프론트에서 직접 필터링합니다.

```ts
const filteredProjects = MOCK_PROJECTS.filter((p) => {
  const matchCategory = selectedCategory ? p.category === selectedCategory : true
  const matchSearch = searchQuery
    ? p.title.includes(searchQuery) || p.techStack.some(...)
    : true
  return matchCategory && matchSearch
})
```

---

### 4. 분야 카테고리 — 하드코딩

현재 분야 목록이 배열로 고정되어 있습니다.

```ts
const CATEGORIES = [
  { label: 'IT/소프트웨어', emoji: '💻' },
  { label: '경영/경제', emoji: '📊' },
  { label: '디자인/UI·UX', emoji: '🎨' },
  // ... 총 9개
]
```

---

### 5. 알림 — 더미

알림 버튼의 빨간 점은 현재 항상 표시됩니다. 실제 알림 데이터와 연결되어 있지 않습니다.

```tsx
{/* 알림 뱃지 — 항상 표시 중, 실제 API 연동 필요 */}
<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
```

---

## 백엔드 연동 가이드

### 1. 로그인 상태 연동

```ts
// 현재 (하드코딩)
const useAuth = () => {
  const [isLoggedIn] = useState(false)
  ...
}

// 교체 (NextAuth)
import { useSession } from 'next-auth/react'

const useAuth = () => {
  const { data: session } = useSession()
  const isLoggedIn = !!session
  const userName = session?.user?.name ?? null
  return { isLoggedIn, userName }
}
```

---

### 2. 프로젝트 목록 API 연동

```ts
// 현재 (목업)
const filteredProjects = MOCK_PROJECTS.filter(...)

// 교체 — useEffect로 API 호출
const [projects, setProjects] = useState<Project[]>([])

useEffect(() => {
  const params = new URLSearchParams()
  if (searchQuery) params.set('q', searchQuery)
  if (selectedCategory) params.set('category', selectedCategory)

  fetch(`/api/projects?${params}`)
    .then((res) => res.json())
    .then((data) => setProjects(data.projects))
}, [searchQuery, selectedCategory])
```

---

### 3. AI 추천 API 연동

```ts
// 현재: MOCK_PROJECTS 전체를 추천으로 표시
// 교체: 로그인 사용자의 프로필 기반 추천

useEffect(() => {
  if (!isLoggedIn) return
  fetch('/api/projects/recommend')
    .then((res) => res.json())
    .then((data) => setRecommendedProjects(data.projects))
}, [isLoggedIn])
```

---

## API 스펙

백엔드 담당자에게 전달할 스펙입니다.

### GET /api/projects

```ts
// 요청 파라미터 (선택)
q: string          // 키워드 검색
category: string   // 분야 필터

// 응답
{
  projects: {
    id: number
    title: string
    description: string
    category: string
    techStack: string[]
    currentMembers: number
    maxMembers: number
    daysLeft: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    isUrgent: boolean    // 마감 7일 이내 시 true
  }[]
}
```

### GET /api/projects/recommend

로그인 사용자의 역할, 스택, 경력 기반 추천 프로젝트 반환.
응답 형태는 `GET /api/projects`와 동일합니다.

---

## TODO

### 프론트엔드
- [ ] `useAuth` → `useSession()`으로 교체
- [ ] `MOCK_PROJECTS` → `GET /api/projects` 호출로 교체
- [ ] AI 추천 → `GET /api/projects/recommend` 호출로 교체
- [ ] 알림 🔔 → 실제 알림 API 연동
- [ ] 참여하기 버튼 → 실제 지원 API 연동

### 백엔드 (담당자)
- [ ] `GET /api/projects` 구현 (검색 + 필터 포함)
- [ ] `GET /api/projects/recommend` 구현 (로그인 사용자 기반)
- [ ] 마감 임박 기준 정의 및 `isUrgent` 필드 서버에서 계산
