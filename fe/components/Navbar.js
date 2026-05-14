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

function ShopIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
    >
      <defs>
        <linearGradient id="shopDropGrad" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.5C9.4 7.1 7 10.4 7 14c0 3.2 2.1 5.5 5 5.5s5-2.3 5-5.5c0-3.6-2.4-6.9-5-10.5Z"
        fill="url(#shopDropGrad)"
      />
      <path
        d="M9.3 10.2c-.6 1.1-.9 2.1-.9 3.2 0 1.4.5 2.4 1.6 3.1"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.45"
      />
      <ellipse
        cx="10.4"
        cy="8.8"
        rx="1.4"
        ry="2.1"
        fill="white"
        opacity="0.45"
        transform="rotate(-18 10.4 8.8)"
      />
    </svg>
  );
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
          setUser(latestUser);
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

  const shopButtonClass =
    `${navPillClass} gap-2 border border-sky-100 bg-sky-50 text-slate-800 shadow-sm hover:border-sky-200 hover:bg-sky-100 hover:text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-slate-100 dark:hover:border-sky-400/40 dark:hover:bg-sky-500/20`;

  const themeButtonClass = isDarkTheme
    ? `${navPillClass} border border-slate-500 bg-slate-200 text-slate-800 hover:bg-slate-100`
    : `${navPillClass} border border-slate-300 bg-slate-700 text-white hover:bg-slate-800`;

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
                onClick={() => router.push("/mypage")}
                className="text-slate-700 transition hover:text-red-600 dark:text-slate-200 dark:hover:text-red-400"
              >
                마이페이지
              </button>

              <button
                onClick={() => router.push("/memoir?view=list")}
                className="text-slate-700 transition hover:text-red-600 dark:text-slate-200 dark:hover:text-red-400"
              >
                나의 회고
              </button>
            </>
          )}

          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className="text-slate-700 transition hover:text-red-600 dark:text-slate-200 dark:hover:text-red-400"
            >
              관리자
            </button>
          )}

          {isAuthenticated && (
            <span className="hidden max-w-[180px] truncate text-slate-500 dark:text-slate-400 sm:inline">
              {user?.nickname || user?.email || "로그인됨"}
            </span>
          )}

          {authStatus === "checking" ? (
            <span className="rounded-lg border border-slate-200 px-4 py-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              로그인 확인 중
            </span>
          ) : (
            <>
              {isAuthenticated && (
                <button
                  onClick={() => router.push("/coins")}
                  className={shopButtonClass}
                  aria-label="물방울 상점"
                  title="물방울 상점"
                >
                  <ShopIcon />
                  <span>상점</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleThemeToggle}
                className={themeButtonClass}
                aria-label={isDarkTheme ? "라이트 모드로 전환" : "다크 모드로 전환"}
                title={isDarkTheme ? "라이트 모드" : "다크 모드"}
              >
                {isDarkTheme ? "라이트" : "다크"}
              </button>

              {isAuthenticated ? (
                <button onClick={handleLogout} className={authButtonClass}>
                  로그아웃
                </button>
              ) : (
                <button onClick={() => router.push("/login")} className={authButtonClass}>
                  로그인
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}