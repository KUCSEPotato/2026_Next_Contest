"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  AUTH_CHANGED_EVENT,
  getStoredUser,
  getToken,
  loadCurrentUser,
  logoutSession,
  refreshAccessToken,
  removeToken,
  updateStoredUser,
} from "../lib/auth";
import { getMyProfileApi } from "../lib/api";

const THEME_STORAGE_KEY = "devory-theme";

function getCurrentTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");
  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setTheme(getCurrentTheme());
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

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

  const handleLogout = async () => {
    await logoutSession({ reason: "logout" });
    setToken(null);
    setUser(null);
    setAuthStatus("anonymous");
    router.push("/login");
  };

  const handleThemeToggle = () => {
    const currentTheme = getCurrentTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  const isAuthenticated = authStatus === "authenticated" && token;
  const isDarkTheme = theme === "dark";
  const navPillClass =
    "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-bold transition";
  const shopButtonClass = `${navPillClass} gap-2 border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-red-200 hover:bg-slate-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-500/70 dark:hover:bg-slate-800 dark:hover:text-red-300`;
  const themeButtonClass = isDarkTheme
    ? `${navPillClass} order-last border border-slate-500 bg-slate-200 text-slate-800 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-200 dark:text-slate-800 dark:hover:bg-slate-100`
    : `${navPillClass} order-last border border-slate-300 bg-slate-700 text-white hover:bg-slate-800`;
  const authButtonClass = `${navPillClass} bg-red-600 text-white hover:bg-red-700`;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <button onClick={() => router.push("/mainpage")}>
          <Image
            src={isDarkTheme ? "/logo_colored_white.svg" : "/logo_colored.svg"}
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
                className={shopButtonClass}
                aria-label="물방울 상점"
                title="물방울 상점"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8h12l-1 12H7L6 8Z" />
                  <path d="M9 8a3 3 0 0 1 6 0" />
                  <path d="M9.5 13h5" />
                  <path d="M10 16h4" />
                </svg>
                <span>상점</span>
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
            className="text-slate-700 transition hover:text-red-600 dark:text-slate-200 dark:hover:text-red-400"
          >
            나의 회고
          </button>

          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className="text-slate-700 transition hover:text-red-600 dark:text-slate-200 dark:hover:text-red-400"
            >
              관리자
            </button>
          )}



          {authStatus === "checking" ? (
            <span className="rounded-lg border border-slate-200 px-4 py-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              로그인 확인 중
            </span>
          ) : isAuthenticated ? (
            <>
              <span className="hidden max-w-[180px] truncate text-slate-500 dark:text-slate-400 sm:inline">
                {user?.nickname || user?.email || "로그인됨"}
              </span>
              
          <button
            type="button"
            onClick={handleThemeToggle}
            className={themeButtonClass}
            aria-label={isDarkTheme ? "라이트 모드로 전환" : "다크 모드로 전환"}
            title={isDarkTheme ? "라이트 모드" : "다크 모드"}
          >
            {isDarkTheme ? "라이트" : "다크"}
          </button>
              
              <button
                onClick={handleLogout}
                className={authButtonClass}
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className={authButtonClass}
            >
              로그인
            </button>
          )}



        </div>
      </div>
    </nav>
  );
}
