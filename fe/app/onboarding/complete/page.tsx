'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding'

// ─── 타입 정의 ────────────────────────────────────────────────
// TODO: 백엔드 API 연동 후 @/app/api/recommend/route에서 import로 교체
export interface ProjectRecommendation {
  id: string
  title: string
  description: string
  type: 'new' | 'inherit'
  matchScore: number
  matchReason: string
  techStack: string[]
  teamSize: number
  currentMembers: number
  roles: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  owner: {
    name: string
    avatarInitial: string
    level: string
  }
}

// ─── 목업 데이터 ───────────────────────────────────────────────
// TODO: 백엔드 API(/api/recommend) 연동 후 아래 MOCK_PROJECTS 및
//       useMockData 플래그를 제거하고 fetchRecommendations()만 사용
const USE_MOCK_DATA = true

const MOCK_PROJECTS: ProjectRecommendation[] = [
  {
    id: 'proj-1',
    title: '오픈소스 코드 리뷰 봇',
    description: 'GitHub PR에 자동으로 리뷰 코멘트를 달아주는 AI 봇.',
    type: 'new',
    matchScore: 98,
    matchReason: '기술 스택 2개 일치, 백엔드 개발자 모집 중이에요.',
    techStack: ['Python', 'FastAPI', 'OpenAI'],
    teamSize: 4,
    currentMembers: 2,
    roles: ['backend', 'ai'],
    difficulty: 'medium',
    owner: { name: '이동영', avatarInitial: 'DY', level: '중급' },
  },
  {
    id: 'proj-2',
    title: '개발자 포트폴리오 생성기',
    description: 'GitHub 프로필을 분석해 자동으로 포트폴리오 페이지를 생성하는 웹 서비스.',
    type: 'new',
    matchScore: 91,
    matchReason: 'Next.js 스택 일치, 프론트엔드 포지션이 오픈되어 있어요.',
    techStack: ['Next.js', 'TypeScript', 'Prisma'],
    teamSize: 3,
    currentMembers: 1,
    roles: ['frontend', 'backend'],
    difficulty: 'easy',
    owner: { name: '한은규', avatarInitial: 'EG', level: '중급' },
  },
  {
    id: 'proj-3',
    title: '중단된 알고리즘 시각화 툴',
    description: '정렬/탐색 알고리즘을 인터랙티브하게 시각화하는 교육용 웹앱. 개발 60% 완료 후 중단.',
    type: 'inherit',
    matchScore: 85,
    matchReason: 'React 스택 호환, 바로 이어받아 완성할 수 있어요.',
    techStack: ['React', 'TypeScript', 'D3.js'],
    teamSize: 2,
    currentMembers: 0,
    roles: ['frontend'],
    difficulty: 'medium',
    owner: { name: '김태연', avatarInitial: 'TY', level: '고급' },
  },
  {
    id: 'proj-4',
    title: 'AI 일정 최적화 앱',
    description: '팀원들의 캘린더를 분석해 최적 미팅 시간을 제안하는 앱.',
    type: 'new',
    matchScore: 78,
    matchReason: 'AI/ML 관심 분야 일치, 데이터 분석 역할을 찾고 있어요.',
    techStack: ['Flutter', 'Python', 'FastAPI'],
    teamSize: 4,
    currentMembers: 2,
    roles: ['mobile', 'backend'],
    difficulty: 'hard',
    owner: { name: '이정민', avatarInitial: 'JM', level: '고급' },
  },
]

// ─── 상수 ─────────────────────────────────────────────────────
const DIFFICULTY_LABEL = { easy: '쉬움', medium: '보통', hard: '어려움' }
const DIFFICULTY_COLOR = {
  easy: 'text-emerald-400 bg-emerald-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  hard: 'text-rose-400 bg-rose-400/10',
}

type Status = 'loading' | 'ready' | 'error'

// ─── 페이지 컴포넌트 ──────────────────────────────────────────
export default function CompletePage() {
  const router = useRouter()
  const { roles, stack, level, name, setField } = useOnboardingStore()

  const [status, setStatus] = useState<Status>('loading')
  const [projects, setProjects] = useState<ProjectRecommendation[]>([])

  useEffect(() => {
    if (!level) {
      router.replace('/onboarding/step3')
      return
    }

    const load = async () => {
      try {
        if (USE_MOCK_DATA) {
          // 목업: 로딩 UX 확인을 위해 1.5초 딜레이
          await new Promise((r) => setTimeout(r, 1500))
          setProjects(MOCK_PROJECTS)
        } else {
          // 실제 API 호출 — 백엔드 연동 후 USE_MOCK_DATA를 false로 변경
          const res = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles, stack, level }),
          })
          if (!res.ok) throw new Error('API 오류')
          const data = await res.json()
          setProjects(data.projects)
        }

        setStatus('ready')
        setField('completedAt', new Date().toISOString())
        // analytics.track('onboarding_complete', { roles, stack, level })
      } catch {
        setStatus('error')
      }
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 로딩 ─────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 animate-fade-in">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
          <div className="absolute inset-3 rounded-full bg-indigo-500/10 flex items-center justify-center text-xl">
            🤖
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-white/70">AI가 프로젝트를 분석하는 중...</p>
          <p className="text-xs text-white/30">기술 스택과 역할을 기반으로 매칭하고 있어요</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ─── 에러 ─────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm text-white/60">추천을 불러오는 데 실패했어요.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white/70 transition border border-white/20"
        >
          다시 시도
        </button>
      </div>
    )
  }

  // ─── Aha Moment ───────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
          ✓ 설정 완료
        </span>
        <h1 className="text-2xl font-semibold tracking-tight leading-snug">
          {name ? `${name}님에게` : '딱'} 맞는 프로젝트를
          <br />
          <span className="text-indigo-400">바로 찾았어요 ✨</span>
        </h1>
        <p className="text-sm text-white/40">
          지금 바로 참여하거나, 중단된 프로젝트를 이어받을 수 있어요.
        </p>
      </div>

      <div className="space-y-2.5">
        {projects.map((project, i) => (
          <ProjectCard key={project.id} project={project} rank={i} />
        ))}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-[2] py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-medium text-white transition-all"
        >
          대시보드에서 더 보기 →
        </button>
        <button
          onClick={() => router.push('/projects')}
          className="flex-1 py-3 rounded-xl border border-white/30 bg-white/8 text-sm text-white/60 hover:text-white hover:bg-white/15 transition-all"
        >
          전체 탐색
        </button>
      </div>
    </div>
  )
}

// ─── 프로젝트 카드 ────────────────────────────────────────────
function ProjectCard({ project, rank }: { project: ProjectRecommendation; rank: number }) {
  const router = useRouter()

  const scoreColor =
    project.matchScore >= 90
      ? 'text-emerald-400'
      : project.matchScore >= 70
      ? 'text-amber-400'
      : 'text-white/40'

  return (
    <div
      className="group relative p-4 rounded-xl border border-white/15 bg-white/5 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-200 cursor-pointer"
      style={{ animationDelay: `${rank * 80}ms` }}
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
            {project.owner.avatarInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{project.title}</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {project.owner.name} · {project.owner.level}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`text-base font-semibold ${scoreColor}`}>{project.matchScore}%</span>
          <span className="text-[10px] text-white/25">매칭</span>
        </div>
      </div>

      <p className="text-xs text-white/40 leading-relaxed mb-3 pl-[42px]">
        {project.matchReason}
      </p>

      <div className="flex items-center gap-2 flex-wrap pl-[42px]">
        {project.type === 'inherit' && (
          <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
            이어받기
          </span>
        )}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[project.difficulty]}`}>
          {DIFFICULTY_LABEL[project.difficulty]}
        </span>
        <span className="text-[10px] text-white/30">
          팀 {project.currentMembers}/{project.teamSize}명
        </span>
        {project.techStack.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] text-white/35 bg-white/8 px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
      </div>

      <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-indigo-400 font-medium">
          {project.type === 'inherit' ? '이어받기 →' : '참여하기 →'}
        </span>
      </div>
    </div>
  )
}
