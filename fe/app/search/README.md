# Devory — 검색 페이지 (프론트엔드)

> 사용자가 키워드 검색 및 필터를 통해 원하는 프로젝트를 탐색하는 페이지입니다.
> 메인 페이지 검색창 클릭 시 이 페이지로 이동합니다.

---

## 목차

1. [개요](#개요)
2. [현재 상태 — 목업 vs 실제](#현재-상태--목업-vs-실제)
3. [화면 구성](#화면-구성)
4. [파일 위치](#파일-위치)
5. [하드코딩 데이터 상세](#하드코딩-데이터-상세)
6. [목업 데이터 상세](#목업-데이터-상세)
7. [백엔드 연동 가이드](#백엔드-연동-가이드)
8. [API 스펙](#api-스펙)
9. [TODO](#todo)

---

## 개요

- 메인 페이지(`/mainpage`) 검색창 클릭 시 `/search`로 이동합니다.
- 키워드 검색과 필터(분야, 기술스택, 난이도, 기간, 목적)를 조합해서 프로젝트를 탐색할 수 있습니다.
- 검색 결과가 없을 때 😢 메시지와 함께 비슷한 추천 프로젝트 3개를 보여줍니다.
- 모바일에서는 필터가 하단 모달로 표시됩니다.
- **현재 검색, 필터, 프로젝트 데이터 모두 목업/하드코딩으로 동작합니다.**

---

## 현재 상태 — 목업 vs 실제

| 기능 | 현재 상태 | 백엔드 연동 후 |
|------|-----------|----------------|
| 프로젝트 목록 | `MOCK_PROJECTS` 배열 6개 고정 | `GET /api/projects` 호출 결과로 교체 |
| 키워드 검색 | 프론트에서 `MOCK_PROJECTS` 필터링 | `GET /api/projects?q=키워드` 호출로 교체 |
| 분야 필터 | 프론트에서 `MOCK_PROJECTS` 필터링 | `GET /api/projects?category=분야` 호출로 교체 |
| 기술스택 필터 | 프론트에서 `MOCK_PROJECTS` 필터링 | `GET /api/projects?stack=스택` 호출로 교체 |
| 난이도 필터 | 프론트에서 `MOCK_PROJECTS` 필터링 | `GET /api/projects?difficulty=난이도` 호출로 교체 |
| 기간 필터 | UI만 있고 실제 필터링 안 됨 | `GET /api/projects?duration=기간` 호출로 교체 |
| 목적 필터 | 프론트에서 `MOCK_PROJECTS` 필터링 | `GET /api/projects?purpose=목적` 호출로 교체 |
| 결과 없을 때 추천 | `MOCK_PROJECTS`에서 앞 3개 노출 | `GET /api/projects/recommend` 호출로 교체 |
| 분야 목록 | 9개 하드코딩 | `GET /api/categories` 호출로 교체 가능 |
| 기술스택 목록 | 14개 하드코딩 | `GET /api/tech-stacks` 호출로 교체 가능 |
| 마감 임박 뱃지 | `isUrgent` 필드 하드코딩 | 마감일 기준 서버에서 계산 |

---

## 화면 구성

```
┌────────────────────────────────────────────────────────┐
│ 네비게이션 바                                            │
│ 로고 | 검색창 (입력 + 검색 버튼) | 필터 버튼 (모바일)   │
├──────────────┬─────────────────────────────────────────┤
│ 필터 사이드바 │ 검색 결과                                │
│ (데스크탑)   │                                          │
│              │ "OOO" 검색 결과 N개                      │
│ [분야]       │ ┌──────────┐ ┌──────────┐               │
│ IT/소프트웨어 │ │ 카드     │ │ 카드     │               │
│ 경영/경제    │ │ - 카테고리│ │          │               │
│ ...          │ │ - 제목   │ │          │               │
│              │ │ - 설명   │ │          │               │
│ [기술스택]   │ │ - 스택   │ │          │               │
│ Python       │ │ - 인원   │ │          │               │
│ TypeScript   │ │ - 마감일 │ │          │               │
│ ...          │ └──────────┘ └──────────┘               │
│              │                                          │
│ [난이도]     │ 결과 없을 때:                            │
│ 입문/중급/고급│ 😢 해당 검색 결과가 없어요               │
│              │ 이건 어때요?                             │
│ [기간]       │ → 추천 프로젝트 3개 노출                 │
│ 1개월 이하   │                                          │
│ ...          │                                          │
│              │                                          │
│ [목적]       │                                          │
│ 포트폴리오   │                                          │
│ 창업/스터디  │                                          │
└──────────────┴─────────────────────────────────────────┘
```

---

## 파일 위치

```
fe/
└── app/
    └── search/
        └── page.tsx    ← 검색 페이지 전체
```

---

## 하드코딩 데이터 상세

### 1. 분야(카테고리) 목록 — 하드코딩

현재 분야 9개가 배열로 고정되어 있습니다.

```ts
// page.tsx 상단
const CATEGORIES = [
  'IT/소프트웨어', '경영/경제', '디자인/UI·UX',
  'AI/데이터', '교육/학습', '금융/핀테크',
  '커머스/쇼핑', '소셜/커뮤니티', '헬스케어',
]
```

백엔드에서 분야 목록을 관리하려면 `GET /api/categories`로 교체하면 됩니다.
분야가 고정값이라면 하드코딩 그대로 유지해도 무방합니다.

---

### 2. 기술스택 목록 — 하드코딩

현재 기술스택 14개가 배열로 고정되어 있습니다.

```ts
const TECH_STACKS = [
  'Python', 'TypeScript', 'JavaScript', 'Java', 'Kotlin',
  'Next.js', 'React', 'Vue', 'FastAPI', 'Django',
  'Spring', 'Flutter', 'React Native', 'Node.js',
]
```

실제 서비스에서는 프로젝트에 등록된 기술스택을 동적으로 가져오는 게 좋습니다.

---

### 3. 난이도 목록 — 하드코딩

```ts
const DIFFICULTIES = [
  { id: 'beginner', label: '입문' },
  { id: 'intermediate', label: '중급' },
  { id: 'advanced', label: '고급' },
]
```

난이도는 고정값이므로 하드코딩 유지해도 됩니다.

---

### 4. 기간 목록 — 하드코딩 (필터링 미구현)

```ts
const DURATIONS = ['1개월 이하', '1~3개월', '3~6개월', '6개월 이상']
```

> ⚠️ **중요:** 기간 필터는 현재 UI만 있고 실제 필터링이 구현되어 있지 않습니다.
> 백엔드 연동 시 `daysLeft` 또는 별도 `duration` 필드 기준으로 필터링 로직을 추가해야 합니다.

---

### 5. 목적 목록 — 하드코딩

```ts
const PURPOSES = ['포트폴리오', '창업', '스터디']
```

목적도 고정값이므로 하드코딩 유지해도 됩니다.

---

## 목업 데이터 상세

### MOCK_PROJECTS 배열

현재 프로젝트 6개가 파일 상단에 하드코딩되어 있습니다.
백엔드 API 연동 후 이 배열 전체를 삭제하면 됩니다.

```ts
// ⚠️ 목업 데이터 — 백엔드 API 연동 후 삭제
const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'AI 코드 리뷰 봇',
    description: 'GitHub PR에 자동으로 리뷰 코멘트를 달아주는 AI 봇',
    category: 'AI/데이터',
    techStack: ['Python', 'FastAPI', 'OpenAI'],
    currentMembers: 2,
    maxMembers: 4,
    daysLeft: 3,           // ← 하드코딩 (실제로는 마감일에서 계산)
    difficulty: 'intermediate',
    purpose: ['포트폴리오', '창업'],
    isUrgent: true,        // ← 하드코딩 (실제로는 daysLeft <= 7이면 true)
  },
  // ... 총 6개
]
```

---

### 현재 검색/필터 로직 (프론트 필터링)

현재 API 없이 `MOCK_PROJECTS`를 프론트에서 직접 필터링합니다.
백엔드 연동 후 이 로직을 API 호출로 교체해야 합니다.

```ts
// ⚠️ 현재 프론트 필터링 — 백엔드 연동 후 API 호출로 교체
const results = MOCK_PROJECTS.filter((p) => {
  const matchQuery = query
    ? p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.techStack.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    : true
  const matchCategory = selectedCategories.length
    ? selectedCategories.includes(p.category) : true
  const matchStack = selectedStacks.length
    ? selectedStacks.some((s) => p.techStack.includes(s)) : true
  const matchDifficulty = selectedDifficulties.length
    ? selectedDifficulties.includes(p.difficulty) : true
  const matchPurpose = selectedPurposes.length
    ? selectedPurposes.some((pu) => p.purpose.includes(pu)) : true

  // ⚠️ 기간 필터는 현재 미구현 — matchDuration 로직 추가 필요
  return matchQuery && matchCategory && matchStack && matchDifficulty && matchPurpose
})
```

---

### 결과 없을 때 추천 (목업)

현재 결과가 없을 때 `MOCK_PROJECTS` 앞 3개를 그냥 보여줍니다.
백엔드 연동 후 실제 추천 API로 교체해야 합니다.

```ts
// ⚠️ 목업 추천 — GET /api/projects/recommend 로 교체
const recommended = results.length === 0
  ? MOCK_PROJECTS.filter((p) => !results.includes(p)).slice(0, 3)
  : []
```

---

## 백엔드 연동 가이드

### Step 1 — 프로젝트 목록 및 검색 API 연동

현재 프론트 필터링 로직을 API 호출로 교체합니다.

```ts
// 현재 (프론트 필터링)
const results = MOCK_PROJECTS.filter(...)

// 교체할 코드
const [results, setResults] = useState<Project[]>([])
const [loading, setLoading] = useState(false)

useEffect(() => {
  const fetchProjects = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (selectedCategories.length) params.set('category', selectedCategories.join(','))
    if (selectedStacks.length) params.set('stack', selectedStacks.join(','))
    if (selectedDifficulties.length) params.set('difficulty', selectedDifficulties.join(','))
    if (selectedDuration) params.set('duration', selectedDuration)
    if (selectedPurposes.length) params.set('purpose', selectedPurposes.join(','))

    const res = await fetch(`/api/projects?${params}`)
    const data = await res.json()
    setResults(data.projects)
    setLoading(false)
  }

  fetchProjects()
}, [query, selectedCategories, selectedStacks, selectedDifficulties, selectedDuration, selectedPurposes])
```

---

### Step 2 — 결과 없을 때 추천 API 연동

```ts
// 현재 (목업)
const recommended = MOCK_PROJECTS.slice(0, 3)

// 교체할 코드
const [recommended, setRecommended] = useState<Project[]>([])

useEffect(() => {
  if (results.length === 0) {
    fetch('/api/projects/recommend?limit=3')
      .then((res) => res.json())
      .then((data) => setRecommended(data.projects))
  }
}, [results])
```

---

### Step 3 — 기간 필터 연동

현재 기간 필터는 UI만 있고 실제 필터링이 안 됩니다.
백엔드에서 프로젝트에 `duration` 필드를 추가하거나 `daysLeft` 기준으로 필터링해주세요.

```ts
// 프론트에서 기간 선택값을 API 파라미터로 전달
// 예: selectedDuration = '1~3개월'
// → GET /api/projects?duration=1-3months
```

---

### Step 4 — MOCK_PROJECTS 제거

API 연동 완료 후 파일 상단의 `MOCK_PROJECTS` 배열 전체를 삭제하면 됩니다.

```ts
// 삭제할 코드
const MOCK_PROJECTS: Project[] = [ ... ]  // ← 전체 삭제
```

---

## API 스펙

### GET /api/projects

```ts
// 요청 파라미터 (모두 선택)
q: string           // 키워드 검색 (제목, 설명, 기술스택)
category: string    // 분야 (콤마로 복수 선택 가능) 예: "AI/데이터,IT/소프트웨어"
stack: string       // 기술스택 (콤마로 복수 선택 가능) 예: "Python,React"
difficulty: string  // 난이도 (콤마로 복수 선택 가능) 예: "beginner,intermediate"
duration: string    // 기간 예: "1-3months"
purpose: string     // 목적 (콤마로 복수 선택 가능) 예: "포트폴리오,창업"

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
    daysLeft: number        // 마감까지 남은 일수 (서버에서 계산)
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    purpose: string[]       // ['포트폴리오', '창업', '스터디'] 중 복수
    isUrgent: boolean       // daysLeft <= 7이면 true (서버에서 계산)
  }[]
  total: number             // 전체 결과 수
}
```

---

### GET /api/projects/recommend

결과가 없을 때 보여줄 추천 프로젝트를 반환합니다.

```ts
// 요청 파라미터 (선택)
limit: number   // 반환할 개수 (기본값: 3)

// 응답 — GET /api/projects와 동일한 형태
{
  projects: Project[]
}
```

---

### GET /api/categories (선택)

분야 목록을 동적으로 관리하려는 경우에만 구현합니다.
현재는 프론트에서 하드코딩으로 관리하고 있어 필수가 아닙니다.

```ts
// 응답
{
  categories: string[]
}
```

---

## TODO

### 프론트엔드
- [ ] 기간 필터 실제 필터링 로직 추가 (백엔드 `duration` 필드 정의 후)
- [ ] API 연동 후 `MOCK_PROJECTS` 배열 삭제
- [ ] 검색 결과 로딩 상태 UI 추가 (스켈레톤 또는 스피너)
- [ ] 페이지네이션 또는 무한 스크롤 추가

### 백엔드 (담당자)
- [ ] `GET /api/projects` 구현 (키워드 + 필터 복합 검색)
- [ ] `isUrgent` 필드 서버에서 계산 (daysLeft <= 7이면 true)
- [ ] `duration` 필드 정의 및 필터링 기준 확정
- [ ] `GET /api/projects/recommend` 구현 (결과 없을 때 추천용)
- [ ] 프로젝트에 `purpose` 필드 추가 (포트폴리오 / 창업 / 스터디)
