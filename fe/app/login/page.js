"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveToken } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    const fakeToken = "fake-access-token";

    saveToken(fakeToken);

    console.log("로그인:", email, password);
    router.push("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          로그인
        </h1>

        <p className="mt-2 text-sm text-slate-500 text-center">
          Devory에 오신 것을 환영합니다
        </p>

        {/* 입력 영역 */}
        <div className="mt-6 space-y-4">

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 버튼 */}
        <button
          onClick={handleLogin}
          className="mt-6 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700"
        >
          로그인
        </button>

        {/* 추가 링크 */}
        <div className="mt-4 text-center text-sm text-slate-500">
          계정이 없으신가요?{" "}
          <span className="text-blue-600 hover:underline cursor-pointer">
            회원가입
          </span>
        </div>

      </div>
    </main>
  );
}