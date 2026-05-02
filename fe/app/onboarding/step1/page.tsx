'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useOnboardingStore } from '@/store/onboarding'

export default function Step1() {
  const router = useRouter()
  const { setField } = useOnboardingStore()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name || !form.email || !form.password) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 해요.')
      return
    }

    // API 호출 없이 바로 다음 단계로 — 백엔드 연동 전 UI 확인용
    setField('name', form.name)
    setField('email', form.email)
    router.push('/onboarding/step2')
  }

  const handleOAuth = () => {
    // OAuth는 백엔드 연동 후 활성화 — 지금은 알림만
    alert('GitHub / Google 로그인은 백엔드 연동 후 사용할 수 있어요.\n이메일로 입력해주세요.')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Devory에 오신 걸 환영해요
        </h1>
        <p className="text-sm text-white/50">
          개발자 협업의 새로운 시작. 30초면 충분해요.
        </p>
      </div>

      {/* OAuth 버튼 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleOAuth}
          className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
        >
          <GitHubIcon />
          GitHub
        </button>
        <button
          onClick={handleOAuth}
          className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
        >
          <GoogleIcon />
          Google
        </button>
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/20" />
        <span className="text-xs text-white/40">또는 이메일로</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      {/* 이메일 폼 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름">
            <input
              type="text"
              placeholder="홍길동"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="이메일">
            <input
              type="email"
              placeholder="dev@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-base"
            />
          </Field>
        </div>
        <Field label="비밀번호">
          <input
            type="password"
            placeholder="8자 이상"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input-base"
          />
        </Field>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-medium text-white transition-all mt-1"
        >
          시작하기 →
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/60">{label}</label>
      {children}
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
