"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { saveToken } from "../../lib/auth";
import { loginApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      alert("아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }

    try {
      setIsLoggingIn(true);

      const result = await loginApi(loginId, password);

      saveToken(result.data.access_token);
      localStorage.setItem("refresh_token", result.data.refresh_token);
      localStorage.setItem("user_id", result.data.user_id);

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
          이메일 또는 닉네임으로 로그인하세요
        </p>

        <div className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="이메일 또는 닉네임"
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