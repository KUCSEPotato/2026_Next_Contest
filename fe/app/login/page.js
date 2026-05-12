"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authenticatedFetch, getApiBaseUrl, saveAuthSession } from "../../lib/auth";
import {
  findLoginIdApi,
  loginApi,
  requestPasswordResetApi,
  resetPasswordApi,
} from "../../lib/api";
import { useToast } from "../../components/AppFeedback";

const validatePassword = (value) => value.length >= 8;

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [findEmail, setFindEmail] = useState("");
  const [foundLoginId, setFoundLoginId] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isFinding, setIsFinding] = useState(false);

  const closeModal = () => {
    setModalMode(null);
    setFindEmail("");
    setFoundLoginId("");
    setResetEmail("");
    setResetToken("");
    setNewPassword("");
  };

  const handleGithubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri =
      process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI ||
      `${window.location.origin}/auth/github/callback`;

    if (!clientId) {
      toast.error("GitHub OAuth 환경변수가 설정되지 않았습니다.");
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      toast.warning("아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }

    try {
      setIsLoggingIn(true);

      const result = await loginApi(loginId, password);

      saveAuthSession({
        accessToken: result.data.access_token,
        refreshToken: result.data.refresh_token,
        userId: result.data.user_id,
      });

      const meRes = await authenticatedFetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${result.data.access_token}` },
      });
      const me = await meRes.json();
      if (me.data) {
        saveAuthSession({
          accessToken: result.data.access_token,
          refreshToken: result.data.refresh_token,
          userId: result.data.user_id,
          user: me.data,
        });
      } else {
        toast.error("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.");
        return;
      }

      toast.success("로그인되었습니다.");
      router.push("/mainpage");
    } catch (error) {
      console.error(error);
      toast.error("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFindLoginId = async () => {
    if (!findEmail.trim()) {
      toast.warning("가입한 이메일을 입력해주세요.");
      return;
    }

    try {
      setIsFinding(true);
      const result = await findLoginIdApi(findEmail.trim());
      const nextLoginId = result.data?.login_id;
      setFoundLoginId(nextLoginId || "해당 이메일로 가입된 아이디를 찾을 수 없습니다.");
    } catch (error) {
      console.error(error);
      toast.error("아이디 찾기에 실패했습니다.");
    } finally {
      setIsFinding(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!resetEmail.trim()) {
      toast.warning("가입한 이메일을 입력해주세요.");
      return;
    }

    try {
      setIsFinding(true);
      const result = await requestPasswordResetApi(resetEmail.trim());
      const token = result.data?.reset_token;
      if (!token) {
        toast.error("해당 이메일로 가입된 계정을 찾을 수 없습니다.");
        return;
      }
      setResetToken(token);
      toast.success("재설정 토큰이 발급되었습니다.");
    } catch (error) {
      console.error(error);
      toast.error("비밀번호 재설정 요청에 실패했습니다.");
    } finally {
      setIsFinding(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken || !newPassword.trim()) {
      toast.warning("새 비밀번호를 입력해주세요.");
      return;
    }
    if (!validatePassword(newPassword)) {
      toast.warning("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    try {
      setIsFinding(true);
      await resetPasswordApi(resetToken, newPassword);
      toast.success("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.");
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error("비밀번호 재설정에 실패했습니다.");
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo_colored.svg"
            alt="Devory 로고"
            width={110}
            height={80}
            priority
            className="h-auto w-[110px]"
          />
        </div>

        <h1 className="text-center text-2xl font-bold text-slate-900">로그인</h1>

        <p className="mt-2 text-center text-sm text-slate-500">
          이메일 또는 GitHub로 로그인하세요
        </p>

        <button
          onClick={handleGithubLogin}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-950 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.1c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.39-5.25 5.67.41.35.77 1.04.77 2.1v3.16c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          GitHub로 로그인
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400">또는</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="아이디 또는 이메일"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xl text-slate-400 transition hover:text-slate-700"
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2 text-xs text-slate-500">
          <button type="button" onClick={() => setModalMode("id")} className="hover:text-red-600">
            아이디 찾기
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setModalMode("password")}
            className="hover:text-red-600"
          >
            비밀번호 찾기
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="mt-6 w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isLoggingIn ? "로그인 중..." : "로그인"}
        </button>

        <div className="mt-4 text-center text-sm text-slate-500">
          계정이 없으신가요?{" "}
          <span
            onClick={() => router.push("/signup")}
            className="cursor-pointer font-semibold text-red-600 hover:underline"
          >
            회원가입
          </span>
        </div>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === "id" ? "아이디 찾기" : "비밀번호 찾기"}
              </h2>
              <button onClick={closeModal} className="text-sm text-slate-400 hover:text-slate-700">
                닫기
              </button>
            </div>

            {modalMode === "id" ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="가입한 이메일"
                  value={findEmail}
                  onChange={(e) => setFindEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
                <button
                  onClick={handleFindLoginId}
                  disabled={isFinding}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
                >
                  {isFinding ? "찾는 중..." : "아이디 찾기"}
                </button>
                {foundLoginId && (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                    {foundLoginId}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="가입한 이메일"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
                <button
                  onClick={handleRequestPasswordReset}
                  disabled={isFinding}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-300"
                >
                  {resetToken ? "토큰 다시 받기" : "재설정 토큰 받기"}
                </button>
                {resetToken && (
                  <>
                    <input
                      type="password"
                      placeholder="새 비밀번호"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={isFinding}
                      className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      비밀번호 재설정
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
