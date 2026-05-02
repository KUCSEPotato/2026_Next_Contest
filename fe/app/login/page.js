"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveToken } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    const fakeToken = "fake-access-token";

    saveToken(fakeToken);

    console.log("로그인:", email, password);
    console.log("저장된 토큰:", fakeToken);

    router.push("/");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>로그인</h1>

      <input
        placeholder="email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />
      <br />

      <button onClick={handleLogin}>
        로그인
      </button>
    </div>
  );
}