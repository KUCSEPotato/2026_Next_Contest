'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  isUrgent: boolean
}

// ─── 목업 데이터 ───────────────────────────────────────────────
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
    isUrgent: false,
  },
]

const CATEGORIES = [
  { label: 'IT/소프트웨어', emoji: '💻' },
  { label: '경영/경제', emoji: '📊' },
  { label: '디자인/UI·UX', emoji: '🎨' },
  { label: 'AI/데이터', emoji: '🤖' },
  { label: '교육/학습', emoji: '📚' },
  { label: '금융/핀테크', emoji: '💳' },
  { label: '커머스/쇼핑', emoji: '🛒' },
  { label: '소셜/커뮤니티', emoji: '💬' },
  { label: '헬스케어', emoji: '❤️' },
]

const DIFFICULTY_LABEL = { beginner: '입문', intermediate: '중급', advanced: '고급' }
const DIFFICULTY_COLOR = {
  beginner: 'text-emerald-600 bg-emerald-50',
  intermediate: 'text-amber-600 bg-amber-50',
  advanced: 'text-rose-600 bg-rose-50',
}

// ─── 로그인 상태 (실제 구현 시 NextAuth useSession으로 교체) ───
const useAuth = () => {
  const [isLoggedIn] = useState(true) // TODO: useSession()으로 교체
  const userName = isLoggedIn ? '정민' : null
  return { isLoggedIn, userName }
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function MainPage() {
  const router = useRouter()
  const { isLoggedIn, userName } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const handleProtectedAction = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return false
    }
    return true
  }

  const handleProjectClick = (id: number) => {
    if (!handleProtectedAction()) return
    router.push(`/projects/${id}`)
  }

  const handleApply = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!handleProtectedAction()) return
    router.push(`/projects/${id}`)
  }

  const filteredProjects = MOCK_PROJECTS.filter((p) => {
    const matchCategory = selectedCategory ? p.category === selectedCategory : true
    const matchSearch = searchQuery
      ? p.title.includes(searchQuery) ||
        p.techStack.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-6xl mx-auto px-4 pb-16">

        {/* ── 히어로 영역 ───────────────────────────────────────── */}
        <section className="py-10 sm:py-14 text-center">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            아이디어를 팀으로,<br className="sm:hidden" /> 팀을 프로젝트로
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mb-6">
            AI가 나에게 맞는 프로젝트와 팀원을 연결해드려요
          </p>

          {/* 분야 태그 빠른 선택 */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(selectedCategory === cat.label ? null : cat.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${selectedCategory === cat.label
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                  }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── AI 추천 프로젝트 ──────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-900">
                {isLoggedIn ? `${userName}님을 위한 추천` : '인기 프로젝트'}
              </span>
              {isLoggedIn && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  AI 추천
                </span>
              )}
            </div>
            <button className="text-xs text-gray-400 hover:text-gray-600 transition">더보기 →</button>
          </div>

          {/* 가로 스크롤 카드 */}
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
            {MOCK_PROJECTS.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
                onApply={(e) => handleApply(e, project.id)}
              />
            ))}
          </div>
        </section>

        {/* ── 검색 결과 or 인기 프로젝트 그리드 ───────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-bold text-gray-900">
              {searchQuery || selectedCategory
                ? `검색 결과 (${filteredProjects.length})`
                : '전체 프로젝트'}
            </span>
            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory(null) }}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                필터 초기화
              </button>
            )}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-sm font-medium text-gray-600 mb-1">해당 검색 결과가 없어요 ππ</p>
              <p className="text-xs text-gray-400">다른 키워드나 분야로 검색해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => handleProjectClick(project.id)}
                  onApply={(e) => handleApply(e, project.id)}
                  variant="grid"
                />
              ))}
            </div>
          )}
        </section>

        {/* ── 아이디어 등록 배너 ────────────────────────────────── */}
        <section className="rounded-2xl bg-red-600 p-6 sm:p-8 text-white text-center">
          <p className="text-lg sm:text-xl font-bold mb-2">팀이 없어도 괜찮아요</p>
          <p className="text-sm text-red-100 mb-5">아이디어만 있으면 Devory가 팀을 만들어드려요</p>
          <button
            onClick={() => { if (!handleProtectedAction()) return; router.push('/ideas/new') }}
            className="px-6 py-2.5 bg-white text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
          >
            아이디어 등록하기 →
          </button>
        </section>
      </main>

      {/* ── 로그인 유도 모달 ──────────────────────────────────── */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => router.push('/login')}
        />
      )}
    </div>
  )
}

// ─── 프로젝트 카드 컴포넌트 ────────────────────────────────────
function ProjectCard({
  project,
  onClick,
  onApply,
  variant = 'scroll',
}: {
  project: Project
  onClick: () => void
  onApply: (e: React.MouseEvent) => void
  variant?: 'scroll' | 'grid'
}) {
  const isAlmostFull = project.currentMembers >= project.maxMembers - 1

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all cursor-pointer flex-shrink-0 flex flex-col
        ${variant === 'scroll' ? 'w-64 sm:w-72 p-4' : 'w-full p-4'}
      `}
    >
      {/* 상단 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1">
          {/* 카테고리 */}
          <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {project.category}
          </span>
          {/* 마감 임박 뱃지 */}
          {project.isUrgent && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              🔥 마감 임박
            </span>
          )}
        </div>
        {/* 난이도 */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${DIFFICULTY_COLOR[project.difficulty]}`}>
          {DIFFICULTY_LABEL[project.difficulty]}
        </span>
      </div>

      {/* 제목 */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">{project.title}</h3>
      <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">{project.description}</p>

      {/* 기술스택 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {project.techStack.map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">
            {t}
          </span>
        ))}
      </div>

      {/* 하단 */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {/* 모집 인원 */}
          <span className={isAlmostFull ? 'text-red-500 font-medium' : ''}>
            👥 {project.currentMembers}/{project.maxMembers}명
          </span>
          {/* 마감일 */}
          <span>📅 {project.daysLeft}일 남음</span>
        </div>
        {/* 참여 버튼 */}
        <button
          onClick={onApply}
          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
        >
          참여하기
        </button>
      </div>
    </div>
  )
}

// ─── 로그인 유도 모달 ──────────────────────────────────────────
function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* 모달 */}
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-2">로그인이 필요한 서비스예요</h2>
        <p className="text-sm text-gray-400 mb-6">
          프로젝트 참여 및 아이디어 등록은<br />로그인 후 이용할 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={onLogin}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-medium text-white transition"
          >
            로그인하기
          </button>
        </div>
      </div>
    </div>
  )
}
