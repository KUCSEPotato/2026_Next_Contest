"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function GithubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("processing"); // "processing" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      setStatus("error");
      setErrorMsg("GitHub 인증이 취소되었거나 오류가 발생했어요.");
      return;
    }

    handleGithubCallback(code);
  }, []);

  const handleGithubCallback = async (code) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/oauth/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "GitHub 로그인 실패");

      // 토큰 저장
      localStorage.setItem("access_token", data.data.access_token);
      if (data.data.refresh_token) {
        localStorage.setItem("refresh_token", data.data.refresh_token);
      }
      if (data.data.user_id) {
        localStorage.setItem("user_id", data.data.user_id);
      }

      // 신규 유저 → 회원가입 Step 2 (스택/관심분야 설정)
      // 기존 유저 → 메인페이지
      if (data.data?.is_new_user) {
        router.replace("/signup?step=2&via=github");
      } else {
        router.replace("/mainpage");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "알 수 없는 오류가 발생했어요.");
    }
  };

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">GitHub 연동 실패</h2>
          <p className="mt-2 text-sm text-slate-500">{errorMsg}</p>
          <button
            onClick={() => router.push("/signup")}
            className="mt-6 w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            회원가입으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  // 처리 중 로딩 화면
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
          <svg className="h-7 w-7 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">GitHub 연동 중...</h2>
        <p className="mt-2 text-sm text-slate-500">잠시만 기다려주세요</p>
        <div className="mt-6 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        </div>
      </div>
    </main>
  );
}
