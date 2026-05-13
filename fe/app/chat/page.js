"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyChatRoomsApi } from "../../lib/api";

const CHAT_READ_COUNTS_STORAGE_KEY = "devory_chat_read_counts";

const getStoredChatReadCounts = () => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_COUNTS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export default function MyChatRoomsPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");
  const [readCounts] = useState(() => getStoredChatReadCounts());

  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        const result = await getMyChatRoomsApi();
        setRooms(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error(error);
        alert("채팅방 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadRooms();
  }, []);

  const visibleRooms = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return rooms
      .filter((room) => {
        if (!keyword) return true;
        return (room.room_name || "팀 채팅방").toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;

        if (sortOrder === "oldest") {
          return aTime - bTime;
        }

        return bTime - aTime;
      });
  }, [rooms, searchKeyword, sortOrder]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">내 채팅방</h1>
          <p className="mt-3 text-slate-500">
            내가 참여 중인 프로젝트 채팅방을 모아볼 수 있습니다.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="채팅방 이름으로 검색"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            >
              <option value="latest">최신 알림순</option>
              <option value="oldest">오래된 순</option>
            </select>
          </div>

          {loading ? (
            <p className="text-slate-500">채팅방을 불러오는 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-slate-500">참여 중인 채팅방이 없습니다.</p>
          ) : visibleRooms.length === 0 ? (
            <p className="text-slate-500">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {visibleRooms.map((room) => {
                const unreadCount = Math.max(
                  Number(room.message_count || 0) -
                    Number(readCounts[String(room.room_id)] || 0),
                  0
                );

                return (
                  <button
                    key={room.room_id}
                    onClick={() =>
                      router.push(`/chat/${room.room_id}?projectId=${room.project_id}`)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-red-300 hover:bg-red-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">
                            {room.room_name || "팀 채팅방"}
                          </p>

                          {unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>

                        {room.last_message ? (
                          <p className="mt-2 line-clamp-1 text-sm text-slate-600">
                            {room.last_message_sender_nickname
                              ? `${room.last_message_sender_nickname}: ${room.last_message}`
                              : room.last_message}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">
                            아직 메시지가 없습니다.
                          </p>
                        )}
                      </div>

                      {room.last_message_at && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {new Date(room.last_message_at).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
