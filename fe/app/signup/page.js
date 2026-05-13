"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  authenticatedFetch,
  getApiBaseUrl,
  loadCurrentUser,
  removeToken,
  saveAuthSession,
} from "../../lib/auth";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const API_BASE = getApiBaseUrl();

const SKILLS_LIST = [
  "React", "Next.js", "Vue.js", "Angular", "TypeScript", "JavaScript",
  "Python", "FastAPI", "Django", "Node.js", "Express", "NestJS",
  "Java", "Spring Boot", "Kotlin", "Swift", "Flutter", "React Native",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
  "AWS", "GCP", "Azure", "GraphQL", "Figma", "TailwindCSS",
];

const INTERESTS_LIST = [
  "웹 개발", "모바일 앱", "AI / ML", "데이터 분석", "클라우드 인프라",
  "DevOps", "블록체인", "게임 개발", "UI/UX 디자인", "보안",
  "핀테크", "헬스케어", "교육", "소셜 플랫폼", "이커머스", "SaaS",
];

// ─── 비밀번호 유효성 검사 ──────────────────────────────────────────────────
function validatePassword(pw) {
  return {
    length: pw.length >= 8,
    hasLetter: /[a-zA-Z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
  };
}

// ─── [추가] FastAPI 에러 응답 파싱 헬퍼 ──────────────────────────────────────
function parseApiError(data, fallback = "요청 처리 중 오류가 발생했습니다.") {
  if (!data?.detail) return fallback;
  if (typeof data.detail === "string") {
    if (data.detail === "중복된 아이디입니다.") {
      return "중복된 아이디입니다.";
    }
    if (
      data.detail === "Login id already exists" ||
      data.detail === "Nickname already exists" ||
      data.detail.includes("nickname")
    ) {
      return "이미 존재하는 닉네임입니다.";
    }
    return data.detail;
  }
  if (Array.isArray(data.detail)) {
    return data.detail.map((e) => e.msg).join("\n");
  }
  return fallback;
}

// ─── Step 인디케이터 ──────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ["기본 정보", "스택 & 관심 분야", "완료"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isDone = idx < current;
        const isActive = idx === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isDone
                    ? "bg-red-600 text-white"
                    : isActive
                    ? "bg-red-600 text-white ring-4 ring-red-100"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  isActive ? "text-red-600" : isDone ? "text-slate-500" : "text-slate-300"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mb-4 mx-1 transition-colors duration-500 ${
                  isDone ? "bg-red-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 폼
  const [email, setEmail] = useState("");
  const [realName, setRealName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 후 발급 받은 토큰 (onboarding token)
  const [accessToken, setAccessToken] = useState("");

  // Step 2 선택
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Step 3 AI 추천 프로젝트
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [recommendedProjects, setRecommendedProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const pwChecks = validatePassword(password);
  const pwValid = pwChecks.length && pwChecks.hasLetter && pwChecks.hasNumber;

  // GitHub OAuth 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    const via = params.get("via");
    const tokenFromQuery = params.get("access_token");

    if (via !== "github" || !tokenFromQuery) {
      removeToken({ reason: "signup_entry" });
      return;
    }

    queueMicrotask(async () => {
      try {
        saveAuthSession({
          accessToken: tokenFromQuery,
          userId: params.get("user_id"),
        });
        await loadCurrentUser();
        setAccessToken(tokenFromQuery);

        // 신규 유저는 온보딩 Step2, 기존 유저는 메인으로 이동
        if (stepParam === "2") {
          setStep(2);
        } else if (stepParam === "profile") {
          router.push("/mainpage");
        }
      } catch (error) {
        console.error(error);
        removeToken({ reason: "invalid_signup_token" });
        setAccessToken("");
        window.history.replaceState(null, "", "/signup");
      }
    });
  }, [router]);

  // ── GitHub OAuth ─────────────────────────────────────────────────────────
  const handleGithubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI
    );

    if (!clientId || !process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI) {
      alert("GitHub OAuth 환경변수가 설정되지 않았습니다.");
      return;
    }

    const scope = encodeURIComponent("read:user user:email");
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=signup`;
  };

  // ── Step 1 제출 ───────────────────────────────────────────────────────────
  const handleStep1Submit = async () => {
    // ── [추가] 프론트 유효성 검사 ──────────────────────────────────────────
    if (!email || !realName || !nickname || !phoneNumber || !password) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    // [추가] 이메일 형식 검사 — Pydantic EmailStr 검증 전에 프론트에서 차단
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    // [추가] 닉네임 길이 검사 (백엔드 min_length=2, max_length=50)
    if (nickname.length < 2 || nickname.length > 50) {
      alert("닉네임은 2자 이상 50자 이하로 입력해주세요.");
      return;
    }

    // [추가] 전화번호 길이 검사 (백엔드 min_length=5, max_length=20)
    if (phoneNumber.length < 5 || phoneNumber.length > 20) {
      alert("올바른 전화번호를 입력해주세요.");
      return;
    }

    if (!pwValid) {
      alert("비밀번호 조건을 확인해주세요.");
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          login_id: nickname,
          name: realName,
          phone_number: phoneNumber,
          password,
        }),
      });
      const data = await res.json();

      // [수정] detail이 문자열/배열 모두 처리
      if (!res.ok) throw new Error(parseApiError(data, "회원가입 실패"));

      const token = data.data?.access_token || data.data?.onboarding_token;
      setAccessToken(token);
      saveAuthSession({
        accessToken: token,
        refreshToken: data.data?.refresh_token,
        userId: data.data?.user_id,
        user: data.data?.user,
      });

      setStep(2);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2 제출 ───────────────────────────────────────────────────────────
  const toggleSkill = (skill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleStep2Submit = async () => {
    try {
      setIsSavingProfile(true);
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      // 스킬 등록 (백엔드가 건당 1개씩 받음)
      for (const skill of selectedSkills) {
        await authenticatedFetch(`${API_BASE}/api/v1/users/me/skills`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: skill }),
        });
      }

      // 관심 분야 등록 (백엔드가 건당 1개씩 받음)
      for (const interest of selectedInterests) {
        await authenticatedFetch(`${API_BASE}/api/v1/users/me/interests`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: interest }),
        });
      }

      // 온보딩 완료 처리
      await authenticatedFetch(`${API_BASE}/api/v1/users/me/onboarding/ideas`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      setStep(3);
      setShowCompletionModal(true);
    } catch (err) {
      // [수정] 에러 내용을 콘솔에 출력해 디버깅 용이하게 변경
      console.error("Step2 error:", err);
      alert("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── AI 추천 프로젝트 로드 ─────────────────────────────────────────────────
  const handleViewRecommendations = async () => {
    setShowCompletionModal(false);
    setIsLoadingProjects(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/v1/matching/recommend-projects`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setRecommendedProjects(data.data?.projects || data.data || []);
    } catch {
      setRecommendedProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // ─── 렌더링 ───────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      {/* 완료 팝업 */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">회원가입이 완료되었습니다! 🎉</h2>
            <p className="mt-2 text-sm text-slate-500">
              Devory에 오신 것을 환영해요.<br />AI가 나에게 딱 맞는 프로젝트를 추천해 드릴게요.
            </p>
            <button
              onClick={handleViewRecommendations}
              className="mt-6 w-full rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 transition"
            >
              🤖 AI 추천 프로젝트 보러 가기
            </button>
            <button
              onClick={() => { setShowCompletionModal(false); router.push("/mainpage"); }}
              className="mt-2 w-full rounded-xl py-2 text-sm text-slate-400 hover:text-slate-600 transition"
            >
              나중에 볼게요
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        {/* 로고 */}
        <div className="mb-4 flex justify-center">
          <Image
            src="/logo_colored.svg"
            alt="Devory 로고"
            width={100}
            height={72}
            className="h-auto w-[100px] dark:hidden"
            priority
          />
          <Image
            src="/logo_colored_white.svg"
            alt="Devory 로고"
            width={100}
            height={72}
            className="hidden h-auto w-[100px] dark:block"
            priority
          />
        </div>

        {/* 스텝 인디케이터 */}
        <StepIndicator current={step} />

        {/* ── STEP 1: 기본 정보 ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="text-center text-2xl font-bold text-slate-900">회원가입</h1>
            <p className="mt-1 text-center text-sm text-slate-500">Devory에 가입하고 프로젝트를 시작하세요</p>

            {/* GitHub 버튼 */}
            <button
              onClick={handleGithubLogin}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub으로 시작하기
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">또는 이메일로 가입</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
              <input
                type="text"
                placeholder="실명"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
              <input
                type="text"
                placeholder="닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
              <input
                type="tel"
                placeholder="전화번호 (예: 01012345678)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />

              {/* 비밀번호 + 조건 */}
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleStep1Submit(); }}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* 비밀번호 조건 표시 */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {[
                      { key: "length", label: "8자리 이상" },
                      { key: "hasLetter", label: "알파벳 포함" },
                      { key: "hasNumber", label: "숫자 포함" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${pwChecks[key] ? "bg-green-500" : "bg-slate-200"}`}>
                          {pwChecks[key] && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-xs transition-colors ${pwChecks[key] ? "text-green-600" : "text-slate-400"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleStep1Submit}
              disabled={isSubmitting}
              className="mt-6 w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
            >
              {isSubmitting ? "처리 중..." : "다음 단계 →"}
            </button>

            <div className="mt-4 text-center text-sm text-slate-500">
              이미 계정이 있으신가요?{" "}
              <span onClick={() => router.push("/login")} className="cursor-pointer font-semibold text-red-600 hover:underline">
                로그인
              </span>
            </div>
          </div>
        )}

        {/* ── STEP 2: 스택 & 관심 분야 ──────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-center text-2xl font-bold text-slate-900">나를 소개해요</h1>
            <p className="mt-1 text-center text-sm text-slate-500">
              기술 스택과 관심 분야를 선택하면 AI가 딱 맞는 프로젝트를 추천해드려요
            </p>

            {/* 기술 스택 */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                기술 스택 <span className="font-normal text-slate-400">({selectedSkills.length}개 선택)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {SKILLS_LIST.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedSkills.includes(skill)
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            {/* 관심 분야 */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                관심 분야 <span className="font-normal text-slate-400">({selectedInterests.length}개 선택)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_LIST.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedInterests.includes(interest)
                        ? "border-red-600 bg-red-50 text-red-600 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                ← 이전
              </button>
              <button
                onClick={handleStep2Submit}
                disabled={isSavingProfile}
                className="flex-[2] rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
              >
                {isSavingProfile ? "저장 중..." : "가입 완료하기 🎉"}
              </button>
            </div>

            <button
              onClick={handleStep2Submit}
              disabled={isSavingProfile}
              className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition"
            >
              나중에 설정할게요 (건너뛰기)
            </button>
          </div>
        )}

        {/* ── STEP 3: AI 추천 프로젝트 ──────────────────────────────────── */}
        {step === 3 && !showCompletionModal && (
          <div>
            <h1 className="text-center text-2xl font-bold text-slate-900">AI 추천 프로젝트</h1>
            <p className="mt-1 text-center text-sm text-slate-500">
              선택한 스택과 관심 분야를 기반으로 추천했어요
            </p>

            {isLoadingProjects ? (
              <div className="mt-10 flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
                <p className="text-sm text-slate-500">AI가 프로젝트를 분석 중이에요...</p>
              </div>
            ) : recommendedProjects.length > 0 ? (
              <div className="mt-6 space-y-3 max-h-96 overflow-y-auto">
                {recommendedProjects.map((project, i) => (
                  <div
                    key={project.id || i}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="cursor-pointer rounded-xl border border-slate-200 p-4 transition hover:border-red-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800 line-clamp-1">{project.title}</h3>
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        추천
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">{project.description}</p>
                    {project.tech_stack && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(Array.isArray(project.tech_stack) ? project.tech_stack : [project.tech_stack])
                          .slice(0, 4)
                          .map((tech) => (
                            <span key={tech} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {tech}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-10 text-center text-sm text-slate-400">
                <p>추천 프로젝트를 불러오는 중 문제가 발생했어요.</p>
                <p>메인 페이지에서 둘러보세요!</p>
              </div>
            )}

            <button
              onClick={() => router.push("/mainpage")}
              className="mt-6 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              메인 페이지로 이동 →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
