"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMessagesApi, sendMessageApi } from "../../../lib/api";

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await getMessagesApi(roomId);
      setMessages(result.data);
    } catch (error) {
      console.error(error);
      alert("메시지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [roomId]);

  const handleSend = async () => {
    if (!input.trim()) {
      alert("메시지를 입력해주세요.");
      return;
    }

    const messageText = input;

    try {
      setSending(true);
      setInput("");

      await sendMessageApi(roomId, messageText);

      await loadMessages();
    } catch (error) {
      console.error(error);
      alert("메시지 전송에 실패했습니다.");
      setInput(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-6">
          <p className="text-sm font-semibold text-red-600">
            Room #{roomId}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            채팅 메시지
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            프로젝트 멤버들과 메시지를 주고받을 수 있습니다.
          </p>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto p-6">
          {loading ? (
            <p className="text-slate-500">메시지를 불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p className="text-slate-500">아직 메시지가 없습니다.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-[70%] rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800">
                  <p>{message.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    sender #{message.sender_id}
                  </p>
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="border-t border-slate-200 p-4">
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="메시지를 입력하세요"
            />

            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
            >
              {sending ? "전송 중..." : "전송"}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}