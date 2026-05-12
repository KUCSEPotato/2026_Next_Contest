"use client";

import { usePathname, useRouter } from "next/navigation";

const HIDDEN_PATHS = new Set(["/", "/mainpage"]);
const NAVBAR_HIDDEN_PATHS = new Set(["/login", "/signup"]);

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const normalizedPath = pathname.replace(/\/$/, "") || "/";

  if (HIDDEN_PATHS.has(normalizedPath)) {
    return null;
  }

  const hasNavbar = !NAVBAR_HIDDEN_PATHS.has(normalizedPath);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/mainpage");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`fixed left-5 z-40 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-red-200 hover:text-red-600 ${
        hasNavbar ? "top-20" : "top-5"
      }`}
      aria-label="뒤로 가기"
    >
      <span aria-hidden="true">&lt;</span>
      뒤로
    </button>
  );
}
