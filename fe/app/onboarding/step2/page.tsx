'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore, Role } from '@/store/onboarding'

const ROLES: { id: Role; label: string; emoji: string; desc: string }[] = [
  { id: 'backend',  label: '백엔드',     emoji: '⚙️', desc: '서버 · API · DB' },
  { id: 'frontend', label: '프론트엔드', emoji: '🎨', desc: 'UI · 웹 인터페이스' },
  { id: 'mobile',   label: '앱 개발',    emoji: '📱', desc: 'iOS · Android · RN' },
  { id: 'ai',       label: 'AI / ML',   emoji: '🤖', desc: '모델 · 데이터 분석' },
  { id: 'pm',       label: '기획 / PM', emoji: '💡', desc: '프로젝트 매니징' },
  { id: 'design',   label: '디자이너',   emoji: '✏️', desc: 'UI 디자인 · 브랜딩' },
]

export default function Step2() {
  const router = useRouter()
  const { roles, toggleRole } = useOnboardingStore()

  const canContinue = roles.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          어떤 역할로 참여하시나요?
        </h1>
        <p className="text-sm text-white/50">
          복수 선택 가능해요. 나중에 언제든 수정할 수 있어요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {ROLES.map((role) => {
          const isSelected = roles.includes(role.id)
          return (
            <button
              key={role.id}
              onClick={() => toggleRole(role.id)}
              className={`
                flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-150
                ${isSelected
                  ? 'border-indigo-400 bg-indigo-500/20'
                  : 'border-white/25 bg-white/8 hover:border-white/40 hover:bg-white/12'
                }
              `}
            >
              <span className="text-xl mb-2 leading-none">{role.emoji}</span>
              {/* 선택 여부에 따라 텍스트 색상 명확히 구분 */}
              <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-white/60'}`}>
                {role.label}
              </span>
              <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-white/35'}`}>
                {role.desc}
              </span>
            </button>
          )
        })}
      </div>

      {roles.length > 0 && (
        <p className="text-xs text-white/40 text-center">
          {roles.map((r) => ROLES.find((ro) => ro.id === r)?.label).join(', ')} 선택됨
        </p>
      )}

      <div className="flex gap-3 pt-2">
        {/* 이전 버튼 — 항상 잘 보이게 */}
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-white/30 bg-white/8 text-sm text-white/70 hover:text-white hover:bg-white/15 transition-all"
        >
          이전
        </button>
        {/* 다음 버튼 */}
        <button
          onClick={() => router.push('/onboarding/step3')}
          disabled={!canContinue}
          className={`flex-[2] py-3 rounded-xl text-sm font-medium transition-all
            ${canContinue
              ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/15'
            }
          `}
        >
          {canContinue ? '다음 →' : '역할을 하나 이상 선택해주세요'}
        </button>
      </div>
    </div>
  )
}
