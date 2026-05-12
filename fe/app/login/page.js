"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authenticatedFetch, getApiBaseUrl, saveAuthSession } from "../../lib/auth";
import { loginApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGithubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri =
      process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI ||
      `${window.location.origin}/auth/github/callback`;

    if (!clientId) {
      alert("GitHub OAuth 환경변수가 설정되지 않았습니다.");
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
      alert("아이디와 비밀번호를 모두 입력해주세요.");
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

      const meRes = await authenticatedFetch(
        `${getApiBaseUrl()}/api/v1/auth/me`,
        { headers: { Authorization: `Bearer ${result.data.access_token}` } }
      );
      const me = await meRes.json();
      if (me.data) {
        saveAuthSession({
          accessToken: result.data.access_token,
          refreshToken: result.data.refresh_token,
          userId: result.data.user_id,
          user: me.data,
        });
      } else {
        console.error("/auth/me 응답 이상:", me);
        alert("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.");
        return;
      }

      alert("로그인되었습니다.");
      router.push("/mainpage");
    } catch (error) {
      console.error(error);
      alert("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.");
    } finally {
      setIsLoggingIn(false);
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

        <h1 className="text-center text-2xl font-bold text-slate-900">
          로그인
        </h1>

        <p className="mt-2 text-center text-sm text-slate-500">
          이메일 또는 GitHub로 로그인하세요
        </p>

        <button
          onClick={handleGithubLogin}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-950 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
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
            placeholder="이메일"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />
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
    </main>
  );
}
