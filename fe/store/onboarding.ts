import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'backend' | 'frontend' | 'mobile' | 'ai' | 'pm' | 'design'
export type Level = 'junior' | 'mid' | 'senior'

export interface OnboardingState {
  // 수집 데이터
  name: string
  email: string
  roles: Role[]
  stack: string[]
  level: Level | null
  githubUsername: string

  // 진행 상태
  currentStep: number
  completedAt: string | null

  // 액션
  setField: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void
  toggleRole: (role: Role) => void
  toggleStack: (item: string) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

const initialState = {
  name: '',
  email: '',
  roles: [] as Role[],
  stack: [] as string[],
  level: null as Level | null,
  githubUsername: '',
  currentStep: 1,
  completedAt: null as string | null,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setField: (key, value) => set({ [key]: value }),

      toggleRole: (role) => {
        const roles = get().roles
        set({
          roles: roles.includes(role)
            ? roles.filter((r) => r !== role)
            : [...roles, role],
        })
      },

      toggleStack: (item) => {
        const stack = get().stack
        set({
          stack: stack.includes(item)
            ? stack.filter((s) => s !== item)
            : [...stack, item],
        })
      },

      nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 4) })),
      prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
      reset: () => set(initialState),
    }),
    {
      name: 'devory-onboarding', // localStorage 키
      partialize: (s) => ({     // 저장할 필드만 선택
        name: s.name,
        email: s.email,
        roles: s.roles,
        stack: s.stack,
        level: s.level,
        githubUsername: s.githubUsername,
        currentStep: s.currentStep,
      }),
    }
  )
)
