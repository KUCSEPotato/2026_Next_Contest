"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyChatRoomsApi, getNotificationsApi } from "../lib/api";
import { getToken } from "../lib/auth";
import { getPosts } from "../app/community/_lib/api";

export const NOTICE_LAST_SEEN_STORAGE_KEY = "devory_notice_last_seen_at";

const CHAT_READ_COUNTS_STORAGE_KEY = "devory_chat_read_counts";

type TopActionButtonsProps = {
  tone?: "default" | "emerald";
};

function getStoredChatReadCounts() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_COUNTS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function RedDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900"
    />
  );
}

export default function TopActionButtons({ tone = "default" }: TopActionButtonsProps) {
  const router = useRouter();
  const [hasNewNotice, setHasNewNotice] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const buttonClass =
    tone === "emerald"
      ? "relative rounded-xl border border-emerald-100 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-emerald-700 dark:border-emerald-800/50 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-emerald-300"
      : "relative rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-400/60 dark:hover:text-red-300";

  useEffect(() => {
    let ignore = false;

    async function loadBadges() {
      try {
        const [announcementResult, eventResult] = await Promise.all([
          getPosts({ category: "announcement", page: 1, page_size: 1, sort_by: "latest" }),
          getPosts({ category: "event", page: 1, page_size: 1, sort_by: "latest" }),
        ]);
        if (!ignore) {
          const latestNoticeTime = Math.max(
            ...[...(announcementResult.posts || []), ...(eventResult.posts || [])].map((post) =>
              getTime(post.created_at)
            ),
            0
          );
          const lastSeen = Number(localStorage.getItem(NOTICE_LAST_SEEN_STORAGE_KEY) || 0);
          setHasNewNotice(latestNoticeTime > lastSeen);
        }
      } catch {
        if (!ignore) setHasNewNotice(false);
      }

      if (!getToken()) {
        if (!ignore) {
          setHasUnreadNotification(false);
          setHasUnreadChat(false);
        }
        return;
      }

      try {
        const result = await getNotificationsApi();
        if (!ignore) {
          setHasUnreadNotification(
            (result.data || []).some((notification: { is_read?: boolean }) => !notification.is_read)
          );
        }
      } catch {
        if (!ignore) setHasUnreadNotification(false);
      }

      try {
        const result = await getMyChatRoomsApi();
        const readCounts = getStoredChatReadCounts();
        if (!ignore) {
          setHasUnreadChat(
            (result.data || []).some((room: { room_id?: number; message_count?: number }) => {
              const roomId = String(room.room_id || "");
              return Math.max(Number(room.message_count || 0) - Number(readCounts[roomId] || 0), 0) > 0;
            })
          );
        }
      } catch {
        if (!ignore) setHasUnreadChat(false);
      }
    }

    const timer = window.setTimeout(() => {
      loadBadges();
    }, 0);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-4">
      <button type="button" onClick={() => router.push("/notices")} className={buttonClass}>
        공지
        {hasNewNotice && <RedDot />}
      </button>

      <button type="button" onClick={() => router.push("/notifications")} className={buttonClass}>
        알림
        {hasUnreadNotification && <RedDot />}
      </button>

      <button type="button" onClick={() => router.push("/chat")} className={buttonClass}>
        채팅
        {hasUnreadChat && <RedDot />}
      </button>
    </header>
  );
}
