"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AUTH_CHANGED_EVENT,
  notifySessionExpiredIfNeeded,
} from "../lib/auth";

const PUBLIC_AUTH_PATHS = new Set(["/login", "/signup"]);

export default function AuthSessionNotifier() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleAuthChanged = (event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (
        detail?.status !== "anonymous" ||
        detail?.reason !== "expired" ||
        !detail?.hadSession
      ) {
        return;
      }

      notifySessionExpiredIfNeeded();

      if (!PUBLIC_AUTH_PATHS.has(pathname)) {
        router.push("/login");
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, [pathname, router]);

  return null;
}
