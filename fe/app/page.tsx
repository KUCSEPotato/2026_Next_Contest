"use client";

import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, getToken, removeToken } from "../lib/auth";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const syncAuthState = () => setToken(getToken());

    syncAuthState();
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const handleLogout = () => {
    removeToken();
    setToken(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>홈 페이지</h1>

      {token ? (
        <>
          <p>로그인 상태입니다.</p>
          <button onClick={handleLogout}>로그아웃</button>
        </>
      ) : (
        <>
          <p>로그인하지 않은 상태입니다.</p>
          <a href="/login">로그인하러 가기</a>
        </>
      )}
    </div>
  );
}
