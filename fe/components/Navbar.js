"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  AUTH_CHANGED_EVENT,
  getStoredUser,
  getToken,
  loadCurrentUser,
  refreshAccessToken,
  removeToken,
  updateStoredUser,
} from "../lib/auth";
import { getMyProfileApi } from "../lib/api";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const syncAuthState = async () => {
      const currentToken = getToken();
      const storedUser = getStoredUser();

      if (!cancelled) {
        setToken(currentToken);
        setUser(storedUser);
        setAuthStatus(currentToken ? "authenticated" : "anonymous");
      }

      if (!currentToken || storedUser?.role) {
        return;
      }

      try {
        if (!cancelled) {
          setAuthStatus("checking");
        }
        const currentUser = await loadCurrentUser();
        if (!cancelled) {
          setToken(getToken());
          setUser(currentUser);
          setAuthStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setUser(getStoredUser());
          setAuthStatus(getToken() ? "authenticated" : "anonymous");
        }
      }
    };

    syncAuthState();
    refreshAccessToken().then(syncAuthState).catch(syncAuthState);

    const handleAuthSync = () => {
      syncAuthState();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthSync);
    window.addEventListener("storage", handleAuthSync);
    window.addEventListener("focus", handleAuthSync);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthSync);
      window.removeEventListener("storage", handleAuthSync);
      window.removeEventListener("focus", handleAuthSync);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    let ignore = false;

    async function syncLatestProfile() {
      try {
        const result = await getMyProfileApi();
        if (ignore || !result?.data) return;

        const latestUser = result.data;
        const storedUser = getStoredUser();
        const hasChanged =
          storedUser?.id !== latestUser.id ||
          storedUser?.email !== latestUser.email ||
          storedUser?.nickname !== latestUser.nickname ||
          storedUser?.avatar_url !== latestUser.avatar_url;

        if (hasChanged) {
          updateStoredUser(latestUser);
        } else {
          setUser(storedUser);
        }
      } catch {
        // Keep the last stored user visible if profile sync fails.
      }
    }

    syncLatestProfile();

    return () => {
      ignore = true;
    };
  }, [token]);

  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const handleLogout = () => {
    removeToken();
    setToken(null);
    setUser(null);
    setAuthStatus("anonymous");
    router.push("/login");
  };

  const isAuthenticated = authStatus === "authenticated" && token;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <button onClick={() => router.push("/mainpage")}>
          <Image
            src="/logo_colored.svg"
            alt="Devory 로고"
            width={120}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </button>

        <div className="flex items-center gap-3 text-sm font-semibold">
          {isAuthenticated && (
            <>
              <button
                onClick={() => router.push("/coins")}
                className="text-slate-700 transition hover:text-red-600"
              >
                코인
              </button>
              <button
                onClick={() => router.push("/mypage")}
                className="text-slate-700 transition hover:text-red-600"
              >
                마이페이지
              </button>
            </>
          )}

          <button
            onClick={() => router.push("/memoir?view=list")}
            className="text-slate-700 transition hover:text-red-600"
          >
            나의 회고
          </button>

          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className="text-slate-700 transition hover:text-red-600"
            >
              관리자
            </button>
          )}

          {authStatus === "checking" ? (
            <span className="rounded-lg border border-slate-200 px-4 py-2 text-slate-500">
              로그인 확인 중
            </span>
          ) : isAuthenticated ? (
            <>
              <span className="hidden max-w-[180px] truncate text-slate-500 sm:inline">
                {user?.nickname || user?.email || "로그인됨"}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
