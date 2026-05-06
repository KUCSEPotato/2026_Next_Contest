"use client";

import { useEffect, useState } from "react";
import { getToken, removeToken } from "../lib/auth";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getToken());
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