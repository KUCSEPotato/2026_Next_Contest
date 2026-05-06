'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore, Level } from '@/store/onboarding'

const LANGUAGES = ['Python', 'TypeScript', 'JavaScript', 'Java', 'Kotlin', 'Swift', 'Go', 'Rust', 'C++']
const FRAMEWORKS = ['Next.js', 'React', 'FastAPI', 'Django', 'Spring', 'Flutter', 'PyTorch', 'NestJS', 'Vue']

const LEVELS: { id: Level; label: string; sub: string; badge: string }[] = [
  {
    id: 'junior',
    label: '입문',
    sub: '0 ~ 1년 · 첫 프로젝트 도전 중',
    badge: 'text-emerald-300 bg-emerald-400/15 border border-emerald-400/30',
  },
  {
    id: 'mid',
    label: '중급',
    sub: '1 ~ 3년 · 사이드 프로젝트 경험',
    badge: 'text-amber-300 bg-amber-400/15 border border-amber-400/30',
  },
  {
    id: 'senior',
    label: '고급',
    sub: '3년 이상 · 실무 · 리드 가능',
    badge: 'text-rose-300 bg-rose-400/15 border border-rose-400/30',
  },
]

export default function Step3() {
  const router = useRouter()
  const { stack, toggleStack, level, setField, githubUsername } = useOnboardingStore()

  const canContinue = level !== null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          내 개발 프로필을 알려주세요
        </h1>
        <p className="text-sm text-white/50">
          AI 추천의 핵심 데이터예요. 스택은 나중에 추가할 수 있어요.
        </p>
      </div>

      {/* 경력 수준 — 필수 */}
      <div className="space-y-2.5">
        <label className="text-xs font-medium text-white/60 uppercase tracking-widest">
          경력 수준{' '}
          <span className="text-indigo-400 normal-case tracking-normal">필수</span>
        </label>
        <div className="flex gap-2">
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              onClick={() => setField('level', lv.id)}
              className={`
                flex-1 flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-150
                ${level === lv.id
                  ? 'border-indigo-400 bg-indigo-500/20'
                  : 'border-white/25 bg-white/8 hover:border-white/40 hover:bg-white/12'
                }
              `}
            >
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${lv.badge} mb-2`}>
                {lv.label}
              </span>
              {/* 선택 여부에 따라 텍스트 색상 명확히 구분 */}
              <span className={`text-[11px] leading-relaxed ${level === lv.id ? 'text-white/80' : 'text-white/40'}`}>
                {lv.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 기술 스택 — 선택 */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-white/60 uppercase tracking-widest">
          기술 스택{' '}
          <span className="normal-case tracking-normal text-white/35">선택</span>
        </label>

        <div className="space-y-2">
          <p className="text-[11px] text-white/45">언어</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <Chip
                key={lang}
                label={lang}
                selected={stack.includes(lang)}
                onToggle={() => toggleStack(lang)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-white/45">프레임워크</p>
          <div className="flex flex-wrap gap-2">
            {FRAMEWORKS.map((fw) => (
              <Chip
                key={fw}
                label={fw}
                selected={stack.includes(fw)}
                onToggle={() => toggleStack(fw)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* GitHub 연동 — 선택 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/60 uppercase tracking-widest">
          GitHub{' '}
          <span className="normal-case tracking-normal text-white/35">선택 · 스택 자동 추출</span>
        </label>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/20 bg-white/8">
          <span className="text-white/40 text-sm">github.com/</span>
          <input
            type="text"
            placeholder="username"
            value={githubUsername}
            onChange={(e) => setField('githubUsername', e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {/* 이전 버튼 */}
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-white/30 bg-white/8 text-sm text-white/70 hover:text-white hover:bg-white/15 transition-all"
        >
          이전
        </button>
        {/* 프로젝트 찾아보기 버튼 */}
        <button
          onClick={() => router.push('/onboarding/complete')}
          disabled={!canContinue}
          className={`flex-[2] py-3 rounded-xl text-sm font-medium transition-all
            ${canContinue
              ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/15'
            }
          `}
        >
          {canContinue ? '프로젝트 찾아보기 →' : '경력 수준을 선택해주세요'}
        </button>
      </div>
    </div>
  )
}

// 언어/프레임워크 칩 — 기본 상태부터 충분히 보이게
function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
        ${selected
          ? 'bg-indigo-500/25 border-indigo-400/70 text-indigo-200'
          : 'bg-white/10 border-white/25 text-white/65 hover:border-white/45 hover:text-white/85 hover:bg-white/15'
        }
      `}
    >
      {label}
    </button>
  )
}
