"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function GithubLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mt-6 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900">
          GitHub 연동 중...
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          잠시만 기다려주세요
        </p>
      </div>
    </main>
  );
}

function GithubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState("processing");
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
  }, [searchParams]);

  const handleGithubCallback = async (code) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/auth/oauth/github`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "GitHub 로그인 실패");
      }

      // 토큰 저장
      localStorage.setItem(
        "access_token",
        data.data.access_token
      );

      if (data.data.refresh_token) {
        localStorage.setItem(
          "refresh_token",
          data.data.refresh_token
        );
      }

      if (data.data.user_id) {
        localStorage.setItem(
          "user_id",
          data.data.user_id
        );
      }

      // 신규 유저 → 회원가입 Step2
      // 기존 유저 → 메인페이지
      if (data.data?.is_new_user) {
        router.replace("/signup?step=2&via=github");
      } else {
        router.replace("/mainpage");
      }
    } catch (err) {
      setStatus("error");

      setErrorMsg(
        err instanceof Error
          ? err.message
          : "알 수 없는 오류가 발생했어요."
      );
    }
  };

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-7 w-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-slate-900">
            GitHub 연동 실패
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {errorMsg}
          </p>

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

  return <GithubLoading />;
}

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={<GithubLoading />}>
      <GithubCallbackContent />
    </Suspense>
  );
}