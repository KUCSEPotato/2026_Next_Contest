export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    if (hostname === "devory.kr" || hostname === "www.devory.kr") {
      return "https://api.devory.kr";
    }

    if (hostname === "3.37.87.121") {
      return "http://3.37.87.121:8000";
    }

    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
  }

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }

  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

export const AUTH_CHANGED_EVENT = "auth:changed";

let refreshPromise = null;
let lastSessionExpiredNoticeAt = 0;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notifyAuthChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail }));
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function isExpired(token, skewSeconds = 30) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= (Number(payload.exp) - skewSeconds) * 1000;
}

export function saveToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid access token");
  }
  if (!canUseStorage()) return;

  localStorage.setItem("access_token", token);
  notifyAuthChanged({ status: "authenticated", reason: "token_saved" });
}

export function saveAuthSession({ accessToken, refreshToken, userId, user }) {
  if (!canUseStorage()) return;
  saveToken(accessToken);

  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }
  if (userId !== undefined && userId !== null) {
    localStorage.setItem("user_id", String(userId));
  }
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  notifyAuthChanged({ status: "authenticated", reason: "session_saved" });
}

export function getToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem("refresh_token");
}

export function getStoredUser() {
  if (!canUseStorage()) return null;

  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export function updateStoredUser(user) {
  if (!canUseStorage() || !user) return;

  const currentUser = getStoredUser() || {};
  localStorage.setItem("user", JSON.stringify({ ...currentUser, ...user }));
  notifyAuthChanged({ status: "authenticated", reason: "user_updated" });
}

export function removeToken(options = {}) {
  if (!canUseStorage()) return;

  const reason =
    typeof options === "string" ? options : options.reason || "manual";
  const hadSession = Boolean(
    localStorage.getItem("access_token") ||
      localStorage.getItem("refresh_token") ||
      localStorage.getItem("user")
  );

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user");
  notifyAuthChanged({ status: "anonymous", reason, hadSession });
}

function shouldNotifySessionExpired() {
  const now = Date.now();
  if (now - lastSessionExpiredNoticeAt < 2000) {
    return false;
  }
  lastSessionExpiredNoticeAt = now;
  return true;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/v1/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Refresh token is invalid");
        }
        const data = await res.json();
        const accessToken = data.data?.access_token;
        if (!accessToken) {
          throw new Error("Refresh response did not include an access token");
        }
        saveToken(accessToken);
        return accessToken;
      })
      .catch((error) => {
        removeToken({ reason: "expired" });
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function getValidAccessToken() {
  const token = getToken();
  if (token && !isExpired(token)) {
    return token;
  }
  return refreshAccessToken();
}

export async function authenticatedFetch(input, init = {}) {
  const { suppressAuthExpiredAlert, ...fetchInit } = init;
  const hadAuthBeforeRequest = Boolean(getToken() || getRefreshToken());
  const token = await getValidAccessToken().catch(() => null);
  const headers = new Headers(fetchInit.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const firstResponse = await fetch(input, { ...fetchInit, headers });
  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshedToken = await refreshAccessToken().catch(() => null);
  if (!refreshedToken) {
    if (hadAuthBeforeRequest && !suppressAuthExpiredAlert) {
      removeToken({ reason: "expired" });
    }
    return firstResponse;
  }

  const retryHeaders = new Headers(fetchInit.headers || {});
  retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
  return fetch(input, { ...fetchInit, headers: retryHeaders });
}

export async function loadCurrentUser() {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/me`);
  if (!response.ok) {
    if (response.status === 401) {
      removeToken({ reason: "expired" });
    }
    throw new Error("현재 로그인 정보를 불러오지 못했습니다.");
  }

  const payload = await response.json();
  const user = payload.data;
  if (!user) {
    throw new Error("현재 로그인 응답에 사용자 정보가 없습니다.");
  }

  const accessToken = getToken();
  if (accessToken) {
    saveAuthSession({
      accessToken,
      refreshToken: getRefreshToken(),
      userId: user.id,
      user,
    });
  }

  return user;
}

export function notifySessionExpiredIfNeeded() {
  if (!shouldNotifySessionExpired()) return;
  window.alert("로그인 시간이 만료되었습니다. 다시 로그인해주세요.");
}
