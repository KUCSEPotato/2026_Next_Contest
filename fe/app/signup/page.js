"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signupApi } from "../../lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleSignup = async () => {
    if (!email || !nickname || !password) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    try {
      setIsSigningUp(true);

      await signupApi(email, nickname, password);

      alert("회원가입이 완료되었습니다. 로그인해주세요.");
      router.push("/login");
    } catch (error) {
      console.error(error);
      alert("회원가입에 실패했습니다. (이미 존재하는 계정일 수 있습니다)");
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">

        {/* 로고 */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo_colored.svg"
            alt="Devory 로고"
            width={110}
            height={80}
            className="h-auto w-[110px]"
          />
        </div>

        <h1 className="text-center text-2xl font-bold text-slate-900">
          회원가입
        </h1>

        <p className="mt-2 text-center text-sm text-slate-500">
          Devory에 가입하고 프로젝트를 시작하세요
        </p>

        {/* 입력 */}
        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />

          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSignup();
            }}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />
        </div>

        {/* 버튼 */}
        <button
          onClick={handleSignup}
          disabled={isSigningUp}
          className="mt-6 w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
        >
          {isSigningUp ? "가입 중..." : "회원가입"}
        </button>

        {/* 로그인 이동 */}
        <div className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <span
            onClick={() => router.push("/login")}
            className="cursor-pointer font-semibold text-red-600 hover:underline"
          >
            로그인
          </span>
        </div>

      </div>
    </main>
  );
}