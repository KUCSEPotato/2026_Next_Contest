"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl, saveAuthSession } from "../../../../lib/auth";

const API_BASE = getApiBaseUrl();

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
  const [linkInfo, setLinkInfo] = useState(null);

  const handleGithubCallback = useCallback(async (code, mode = "login") => {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/auth/oauth/github`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, mode }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "GitHub 로그인 실패");
      }

      if (data.data?.requires_link_confirmation) {
        setLinkInfo(data.data);
        setStatus("confirm_link");
        return;
      }

      saveAuthSession({
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        userId: data.data.user_id,
        user: data.data.user,
      });

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
  }, [router]);

  const handleConfirmLink = async () => {
    if (!linkInfo?.link_token) return;

    try {
      setStatus("linking");
      const res = await fetch(`${API_BASE}/api/v1/auth/oauth/link-existing/github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ link_token: linkInfo.link_token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "GitHub 계정 연동 실패");
      }

      saveAuthSession({
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        userId: data.data.user_id,
        user: data.data.user,
      });
      router.replace("/mainpage");
    } catch (err) {
      setStatus("confirm_link");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "GitHub 계정 연동 중 알 수 없는 오류가 발생했어요."
      );
    }
  };

  useEffect(() => {
    const linkToken = searchParams.get("link_token");
    if (linkToken) {
      queueMicrotask(() => {
        setLinkInfo({
          provider: searchParams.get("provider") || "github",
          link_token: linkToken,
          email: searchParams.get("email"),
          nickname: searchParams.get("nickname"),
        });
        setStatus("confirm_link");
      });
      return;
    }

    const code = searchParams.get("code");
    const mode = searchParams.get("state") === "signup" ? "signup" : "login";
    const error = searchParams.get("error");

    if (error || !code) {
      queueMicrotask(() => {
        setStatus("error");
        setErrorMsg("GitHub 인증이 취소되었거나 오류가 발생했어요.");
      });
      return;
    }

    queueMicrotask(() => {
      handleGithubCallback(code, mode);
    });
  }, [handleGithubCallback, searchParams]);

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

  if (status === "confirm_link") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900">
            <svg
              className="h-7 w-7 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.1c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.39-5.25 5.67.41.35.77 1.04.77 2.1v3.16c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-slate-900">
            기존 계정과 GitHub를 연결할까요?
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {linkInfo?.email} 주소로 가입된 계정이 이미 있습니다.
            이 GitHub 계정을 기존 계정에 연결하면 다음부터 GitHub로 로그인할 수 있습니다.
          </p>

          {errorMsg && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </p>
          )}

          <div className="mt-6 space-y-2">
            <button
              onClick={handleConfirmLink}
              className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              기존 계정에 연결하기
            </button>

            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              취소하고 로그인으로 돌아가기
            </button>
          </div>
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
