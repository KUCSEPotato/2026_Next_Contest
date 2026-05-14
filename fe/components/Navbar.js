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
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7" fill="none">
      <path
        d="M8 14.5h16v10.2c0 .9-.7 1.6-1.6 1.6H9.6c-.9 0-1.6-.7-1.6-1.6V14.5Z"
        fill="#ffffff"
        stroke="#334155"
        strokeWidth="1.6"
      />
      <path
        d="M7.2 7.2h17.6l1.6 6.1H5.6l1.6-6.1Z"
        fill="#fee2e2"
        stroke="#334155"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M6 13.3h5.2v1.2a2.6 2.6 0 0 1-5.2 0v-1.2Z" fill="#ef4444" />
      <path d="M11.2 13.3h4.8v1.2a2.4 2.4 0 0 1-4.8 0v-1.2Z" fill="#ffffff" />
      <path d="M16 13.3h4.8v1.2a2.4 2.4 0 0 1-4.8 0v-1.2Z" fill="#ef4444" />
      <path d="M20.8 13.3H26v1.2a2.6 2.6 0 0 1-5.2 0v-1.2Z" fill="#ffffff" />
      <path
        d="M6 13.3h20M11.2 13.3v1.2M16 13.3v1.2M20.8 13.3v1.2"
        stroke="#334155"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M13 26.3v-6.1c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1v6.1"
        fill="#dbeafe"
        stroke="#334155"
        strokeWidth="1.5"
      />
      <path
        d="M9.8 7.2h12.4"
        stroke="#ef4444"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThemeIcon({ isDarkTheme }) {
  if (isDarkTheme) {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7" fill="none">
        <circle cx="16" cy="16" r="6.2" fill="#facc15" stroke="#92400e" strokeWidth="1.5" />
        <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3M7.9 7.9l2.1 2.1M22 22l2.1 2.1M24.1 7.9 22 10M10 22l-2.1 2.1" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7" fill="none">
      <path
        d="M22.8 21.7A9.2 9.2 0 0 1 10.3 9.2 8.5 8.5 0 1 0 22.8 21.7Z"
        fill="#475569"
        stroke="#1e293b"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="20.8" cy="10.1" r="1.2" fill="#94a3b8" />
      <circle cx="24.2" cy="15.4" r="0.9" fill="#94a3b8" />
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

  const iconButtonClass =
    "inline-flex h-11 w-11 items-center justify-center rounded-xl bg-transparent transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800";

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
                  className={iconButtonClass}
                  aria-label="상점"
                  title="상점"
                >
                  <ShopIcon />
                </button>
              )}

              <button
                type="button"
                onClick={handleThemeToggle}
                className={iconButtonClass}
                aria-label={isDarkTheme ? "라이트 모드로 전환" : "다크 모드로 전환"}
                title={isDarkTheme ? "라이트 모드" : "다크 모드"}
              >
                <ThemeIcon isDarkTheme={isDarkTheme} />
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