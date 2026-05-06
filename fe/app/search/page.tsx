'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── 타입 ──────────────────────────────────────────────────────
interface Project {
  id: number
  title: string
  description: string
  category: string
  techStack: string[]
  currentMembers: number
  maxMembers: number
  daysLeft: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  purpose: string[]
  isUrgent: boolean
}

// ─── 목업 데이터 ───────────────────────────────────────────────
// TODO: 백엔드 API(/api/projects) 연동 후 제거
const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'AI 코드 리뷰 봇',
    description: 'GitHub PR에 자동으로 리뷰 코멘트를 달아주는 AI 봇',
    category: 'AI/데이터',
    techStack: ['Python', 'FastAPI', 'OpenAI'],
    currentMembers: 2,
    maxMembers: 4,
    daysLeft: 3,
    difficulty: 'intermediate',
    purpose: ['포트폴리오', '창업'],
    isUrgent: true,
  },
  {
    id: 2,
    title: '개발자 포트폴리오 생성기',
    description: 'GitHub 프로필을 분석해 자동으로 포트폴리오를 만들어주는 서비스',
    category: 'IT/소프트웨어',
    techStack: ['Next.js', 'TypeScript'],
    currentMembers: 1,
    maxMembers: 3,
    daysLeft: 14,
    difficulty: 'beginner',
    purpose: ['포트폴리오'],
    isUrgent: false,
  },
  {
    id: 3,
    title: '스타트업 재무 관리 앱',
    description: '초기 스타트업을 위한 간편 재무 관리 및 투자자 리포트 자동화',
    category: '경영/경제',
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    currentMembers: 2,
    maxMembers: 5,
    daysLeft: 7,
    difficulty: 'intermediate',
    purpose: ['창업'],
    isUrgent: true,
  },
  {
    id: 4,
    title: '헬스케어 챗봇 플랫폼',
    description: '증상 기반으로 병원을 추천해주는 AI 챗봇',
    category: '헬스케어',
    techStack: ['Flutter', 'Python', 'LangChain'],
    currentMembers: 1,
    maxMembers: 4,
    daysLeft: 21,
    difficulty: 'advanced',
    purpose: ['창업', '포트폴리오'],
    isUrgent: false,
  },
  {
    id: 5,
    title: '로컬 소상공인 커머스',
    description: '동네 소상공인을 위한 간편 온라인 스토어 개설 플랫폼',
    category: '커머스/쇼핑',
    techStack: ['Vue', 'Django', 'AWS'],
    currentMembers: 3,
    maxMembers: 5,
    daysLeft: 5,
    difficulty: 'intermediate',
    purpose: ['창업'],
    isUrgent: true,
  },
  {
    id: 6,
    title: '학습 목표 트래커',
    description: '팀과 함께 학습 목표를 설정하고 달성률을 공유하는 앱',
    category: '교육/학습',
    techStack: ['React Native', 'Firebase'],
    currentMembers: 2,
    maxMembers: 3,
    daysLeft: 30,
    difficulty: 'beginner',
    purpose: ['스터디', '포트폴리오'],
    isUrgent: false,
  },
]

// ─── 필터 옵션 ─────────────────────────────────────────────────
const CATEGORIES = [
  'IT/소프트웨어', '경영/경제', '디자인/UI·UX',
  'AI/데이터', '교육/학습', '금융/핀테크',
  '커머스/쇼핑', '소셜/커뮤니티', '헬스케어',
]
const TECH_STACKS = [
  'Python', 'TypeScript', 'JavaScript', 'Java', 'Kotlin',
  'Next.js', 'React', 'Vue', 'FastAPI', 'Django',
  'Spring', 'Flutter', 'React Native', 'Node.js',
]
const DIFFICULTIES = [
  { id: 'beginner', label: '입문' },
  { id: 'intermediate', label: '중급' },
  { id: 'advanced', label: '고급' },
]
const DURATIONS = ['1개월 이하', '1~3개월', '3~6개월', '6개월 이상']
const PURPOSES = ['포트폴리오', '창업', '스터디']

const DIFFICULTY_LABEL = { beginner: '입문', intermediate: '중급', advanced: '고급' }
const DIFFICULTY_COLOR = {
  beginner: 'text-emerald-600 bg-emerald-50',
  intermediate: 'text-amber-600 bg-amber-50',
  advanced: 'text-rose-600 bg-rose-50',
}

// ─── 검색 페이지 ──────────────────────────────────────────────
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SearchPageContent />
    </Suspense>
  )
}

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [inputValue, setInputValue] = useState(searchParams.get('q') || '')

  // 필터 상태
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStacks, setSelectedStacks] = useState<string[]>([])
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([])
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null)
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])

  const [showMobileFilter, setShowMobileFilter] = useState(false)

  // ─── 필터 토글 함수 ─────────────────────────────────────────
  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]

  // ─── 검색 + 필터 적용 ──────────────────────────────────────
  const results = MOCK_PROJECTS.filter((p) => {
    const matchQuery = query
      ? p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.techStack.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
        p.description.toLowerCase().includes(query.toLowerCase())
      : true
    const matchCategory = selectedCategories.length
      ? selectedCategories.includes(p.category)
      : true
    const matchStack = selectedStacks.length
      ? selectedStacks.some((s) => p.techStack.includes(s))
      : true
    const matchDifficulty = selectedDifficulties.length
      ? selectedDifficulties.includes(p.difficulty)
      : true
    const matchPurpose = selectedPurposes.length
      ? selectedPurposes.some((pu) => p.purpose.includes(pu))
      : true
    return matchQuery && matchCategory && matchStack && matchDifficulty && matchPurpose
  })

  // 결과 없을 때 추천 (결과에 없는 프로젝트 중 랜덤 3개)
  const recommended = results.length === 0
    ? MOCK_PROJECTS.filter((p) => !results.includes(p)).slice(0, 3)
    : []

  const hasFilter =
    selectedCategories.length > 0 ||
    selectedStacks.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedDuration !== null ||
    selectedPurposes.length > 0

  const resetFilters = () => {
    setSelectedCategories([])
    setSelectedStacks([])
    setSelectedDifficulties([])
    setSelectedDuration(null)
    setSelectedPurposes([])
  }

  const handleSearch = () => {
    setQuery(inputValue)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 네비게이션 바 ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/mainpage')} className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm hidden sm:block">Devory</span>
          </button>

          {/* 검색창 */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="프로젝트 또는 기술스택 검색"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition flex-shrink-0"
            >
              검색
            </button>
          </div>

          {/* 모바일 필터 버튼 */}
          <button
            onClick={() => setShowMobileFilter(true)}
            className="sm:hidden flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            필터
            {hasFilter && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">

        {/* ── 필터 사이드바 (데스크탑) ────────────────────────── */}
        <aside className="hidden sm:block w-56 flex-shrink-0">
          <FilterPanel
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedStacks={selectedStacks}
            setSelectedStacks={setSelectedStacks}
            selectedDifficulties={selectedDifficulties}
            setSelectedDifficulties={setSelectedDifficulties}
            selectedDuration={selectedDuration}
            setSelectedDuration={setSelectedDuration}
            selectedPurposes={selectedPurposes}
            setSelectedPurposes={setSelectedPurposes}
            hasFilter={hasFilter}
            onReset={resetFilters}
            toggle={toggle}
          />
        </aside>

        {/* ── 검색 결과 ─────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* 결과 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {query && <span className="font-medium text-gray-900">"{query}" </span>}
              {results.length > 0
                ? <span>검색 결과 <span className="text-blue-600 font-medium">{results.length}개</span></span>
                : query || hasFilter ? '검색 결과가 없어요' : '전체 프로젝트'
              }
            </p>
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600 transition">
                필터 초기화
              </button>
            )}
          </div>

          {/* 결과 있을 때 */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/projects/${project.id}`)}
                />
              ))}
            </div>
          )}

          {/* 결과 없을 때 */}
          {results.length === 0 && (query || hasFilter) && (
            <div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-4xl mb-3">😢</p>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  해당 검색 결과가 없어요
                </p>
                <p className="text-xs text-gray-400 mb-1">이건 어때요?</p>
              </div>

              {/* 추천 프로젝트 */}
              {recommended.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">비슷한 프로젝트</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommended.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={() => router.push(`/projects/${project.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 검색어 없고 필터도 없을 때 전체 목록 */}
          {!query && !hasFilter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_PROJECTS.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/projects/${project.id}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── 모바일 필터 모달 ──────────────────────────────────── */}
      {showMobileFilter && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900">필터</span>
            <button onClick={() => setShowMobileFilter(false)} className="text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <FilterPanel
              selectedCategories={selectedCategories}
              setSelectedCategories={setSelectedCategories}
              selectedStacks={selectedStacks}
              setSelectedStacks={setSelectedStacks}
              selectedDifficulties={selectedDifficulties}
              setSelectedDifficulties={setSelectedDifficulties}
              selectedDuration={selectedDuration}
              setSelectedDuration={setSelectedDuration}
              selectedPurposes={selectedPurposes}
              setSelectedPurposes={setSelectedPurposes}
              hasFilter={hasFilter}
              onReset={resetFilters}
              toggle={toggle}
            />
          </div>
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setShowMobileFilter(false)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium"
            >
              결과 보기 ({results.length}개)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 필터 패널 ─────────────────────────────────────────────────
function FilterPanel({
  selectedCategories, setSelectedCategories,
  selectedStacks, setSelectedStacks,
  selectedDifficulties, setSelectedDifficulties,
  selectedDuration, setSelectedDuration,
  selectedPurposes, setSelectedPurposes,
  hasFilter, onReset, toggle,
}: any) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">필터</span>
        {hasFilter && (
          <button onClick={onReset} className="text-xs text-blue-600 hover:text-blue-800">
            초기화
          </button>
        )}
      </div>

      {/* 분야 */}
      <FilterSection title="분야">
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={cat}
            selected={selectedCategories.includes(cat)}
            onClick={() => setSelectedCategories(toggle(selectedCategories, cat))}
          />
        ))}
      </FilterSection>

      {/* 기술스택 */}
      <FilterSection title="기술스택">
        {TECH_STACKS.map((stack) => (
          <FilterChip
            key={stack}
            label={stack}
            selected={selectedStacks.includes(stack)}
            onClick={() => setSelectedStacks(toggle(selectedStacks, stack))}
          />
        ))}
      </FilterSection>

      {/* 난이도 */}
      <FilterSection title="난이도">
        {DIFFICULTIES.map((d) => (
          <FilterChip
            key={d.id}
            label={d.label}
            selected={selectedDifficulties.includes(d.id)}
            onClick={() => setSelectedDifficulties(toggle(selectedDifficulties, d.id))}
          />
        ))}
      </FilterSection>

      {/* 기간 */}
      <FilterSection title="기간">
        {DURATIONS.map((dur) => (
          <FilterChip
            key={dur}
            label={dur}
            selected={selectedDuration === dur}
            onClick={() => setSelectedDuration(selectedDuration === dur ? null : dur)}
          />
        ))}
      </FilterSection>

      {/* 목적 */}
      <FilterSection title="목적">
        {PURPOSES.map((pur) => (
          <FilterChip
            key={pur}
            label={pur}
            selected={selectedPurposes.includes(pur)}
            onClick={() => setSelectedPurposes(toggle(selectedPurposes, pur))}
          />
        ))}
      </FilterSection>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
        ${selected
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
        }`}
    >
      {label}
    </button>
  )
}

// ─── 프로젝트 카드 ─────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {project.category}
          </span>
          {project.isUrgent && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              🔥 마감 임박
            </span>
          )}
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${DIFFICULTY_COLOR[project.difficulty]}`}>
          {DIFFICULTY_LABEL[project.difficulty]}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{project.title}</h3>
      <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">{project.description}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {project.techStack.map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">{t}</span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>👥 {project.currentMembers}/{project.maxMembers}명</span>
          <span>📅 {project.daysLeft}일 남음</span>
        </div>
        <div className="flex gap-1">
          {project.purpose.map((p) => (
            <span key={p} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">{p}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
