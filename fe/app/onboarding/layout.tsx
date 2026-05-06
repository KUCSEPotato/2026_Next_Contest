'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useOnboardingStore } from '@/store/onboarding'

const STEPS = [
  { path: '/onboarding/step1', label: '가입' },
  { path: '/onboarding/step2', label: '역할' },
  { path: '/onboarding/step3', label: '스택' },
  { path: '/onboarding/complete', label: '완료' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentStep, completedAt } = useOnboardingStore()

  const currentIndex = STEPS.findIndex((s) => pathname.startsWith(s.path))
  const progress = currentIndex === -1 ? 0 : ((currentIndex + 1) / STEPS.length) * 100

  // 이미 완료한 사용자가 온보딩 재진입 시 대시보드로
  useEffect(() => {
    if (completedAt && !pathname.includes('complete')) {
      router.replace('/dashboard')
    }
  }, [completedAt, pathname, router])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <span className="text-xs font-bold">D</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-white/80">Devory</span>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((step, i) => {
            const isDone = i < currentIndex
            const isActive = i === currentIndex
            return (
              <div key={step.path} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all duration-300 ${
                      isDone
                        ? 'bg-indigo-500 text-white'
                        : isActive
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white/30'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-[10px] transition-colors ${
                      isActive ? 'text-white/70' : 'text-white/20'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-px mb-4 transition-colors duration-500 ${
                      isDone ? 'bg-indigo-500' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="text-xs text-white/20">{Math.round(progress)}% 완료</div>
      </header>

      {/* 진행 바 */}
      <div className="h-px bg-white/5">
        <div
          className="h-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 콘텐츠 */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  )
}
