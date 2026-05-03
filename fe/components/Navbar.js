"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getToken, removeToken } from "../lib/auth";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const token = getToken();

  if (pathname === "/login") {
    return null;
  }

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <Image
            src="/logo_colored.png"
            alt="Devory 로고"
             width={120}
             height={60}
             className="h-12 w-auto object-contain"
        />
        </button>

        <div className="flex items-center gap-3 text-sm font-semibold">
          <button
            onClick={() => router.push("/mainpage")}
            className="text-slate-600 hover:text-slate-900"
          >
            프로젝트
          </button>

          <button
            onClick={() => router.push("/ideas/new")}
            className="text-slate-600 hover:text-slate-900"
          >
            아이디어 등록
          </button>

          <button
            onClick={() => router.push("/mypage")}
            className="text-slate-600 hover:text-slate-900"
          >
            마이페이지
          </button>

          {token ? (
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}