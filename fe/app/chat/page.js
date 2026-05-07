"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyChatRoomsApi } from "../../lib/api";

export default function MyChatRoomsPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        const result = await getMyChatRoomsApi();
        setRooms(result.data || []);
      } catch (error) {
        console.error(error);
        // alert("채팅방 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadRooms();
  }, []);

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
          {loading ? (
            <p className="text-slate-500">채팅방을 불러오는 중...</p>
          ) : rooms.length === 0 ? (
            <p className="text-slate-500">참여 중인 채팅방이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <button
                  key={room.room_id || room.id}
                  onClick={() => router.push(`/chat/${room.room_id || room.id}`)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-red-300 hover:bg-red-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {room.room_name || room.name || "팀 채팅방"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {room.project_title
                          ? `프로젝트: ${room.project_title}`
                          : `Project #${room.project_id}`}
                      </p>

                      {room.last_message && (
                        <p className="mt-2 line-clamp-1 text-sm text-slate-600">
                          {room.last_message}
                        </p>
                      )}
                    </div>

                    {room.unread_count > 0 && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                        {room.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}