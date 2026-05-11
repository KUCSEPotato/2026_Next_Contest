"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  createTodoApi,
  generateAITodosApi,
  getMessagesApi,
  getProjectApi,
  getTodosApi,
  sendMessageApi,
  toggleTodoDoneApi,
} from "../../../lib/api";
import { useRef } from "react";

export default function ChatRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId;
  const projectId = searchParams.get("projectId");
  const bottomRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myId] = useState(() => {
    if (typeof window === "undefined") return null;
    const userId = localStorage.getItem("user_id");
    return userId ? Number(userId) : null;
  });
  const [projectMembers, setProjectMembers] = useState([]);
  const [todos, setTodos] = useState([]);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoLoading, setTodoLoading] = useState(false);
  const [creatingTodo, setCreatingTodo] = useState(false);
  const [generatingTodos, setGeneratingTodos] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getMessagesApi(roomId);
      setMessages(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      alert("메시지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    Promise.resolve().then(() => loadMessages());
  }, [loadMessages]);

  const loadProjectTodos = useCallback(async () => {
    if (!projectId) return;

    try {
      setTodoLoading(true);

      const [projectResult, todosResult] = await Promise.all([
        getProjectApi(projectId),
        getTodosApi(projectId),
      ]);

      const members = projectResult.data?.members || [];
      setProjectMembers(members);
      setTodos(Array.isArray(todosResult.data) ? todosResult.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setTodoLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    Promise.resolve().then(() => loadProjectTodos());
  }, [loadProjectTodos]);

  useEffect(() => {
    if (!projectId || !roomId) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    const wsBaseUrl = apiBaseUrl.replace(/^http/, "ws");

    const socket = new WebSocket(
      `${wsBaseUrl}/api/v1/chats/projects/${projectId}/rooms/${roomId}/ws?token=${token}`
    );

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "chat.history") {
        setMessages(Array.isArray(payload.data) ? payload.data : []);
      }

      if (payload.type === "chat.message.created") {
        setMessages((prev) => [...prev, payload.data]);
      }
    };

    socket.onerror = (error) => {
      console.error(error);
    };

    return () => {
      socket.close();
    };
  }, [projectId, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

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

  const getProjectMemberIds = () =>
    projectMembers
      .map((member) => member.user_id || member.id || member.user?.id)
      .filter(Boolean);

  const handleCreateTodo = async () => {
    if (!projectId) {
      alert("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    if (!todoTitle.trim()) {
      alert("Todo 제목을 입력해주세요.");
      return;
    }

    try {
      setCreatingTodo(true);

      await createTodoApi(projectId, {
        title: todoTitle.trim(),
        assignee_ids: getProjectMemberIds(),
        stage: "planning",
        status: "todo",
        priority: 3,
      });

      setTodoTitle("");
      await loadProjectTodos();
    } catch (error) {
      console.error(error);
      alert("Todo 생성에 실패했습니다.");
    } finally {
      setCreatingTodo(false);
    }
  };

  const handleToggleTodo = async (todoId) => {
    if (!projectId) return;

    try {
      await toggleTodoDoneApi(projectId, todoId);
      await loadProjectTodos();
    } catch (error) {
      console.error(error);
      alert("Todo 완료 상태를 변경하지 못했습니다.");
    }
  };

  const handleGenerateTodos = async () => {
    if (!projectId) {
      alert("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    if (!confirm("프로젝트 정보와 최근 채팅을 바탕으로 AI Todo를 생성할까요?")) {
      return;
    }

    try {
      setGeneratingTodos(true);

      await generateAITodosApi(projectId, { room_id: Number(roomId) });
      await loadProjectTodos();
      alert("AI Todo가 생성되었습니다.");
    } catch (error) {
      console.error(error);
      alert("AI Todo 생성에 실패했습니다.");
    } finally {
      setGeneratingTodos(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto grid h-[80vh] w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === myId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.sender_id === myId
                        ? "bg-red-500 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p>{message.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {message.sender_nickname || `User #${message.sender_id}`}
                    </p>
                  </div>
                </div>
              ))
            )}

            <div ref={bottomRef} />
          </section>

          <footer className="border-t border-slate-200 p-4">
            <div className="flex gap-3">
              <input
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !sending) {
                    handleSend();
                  }
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

        <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-red-600">Team Todo</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  프로젝트 체크리스트
                </h2>
              </div>

              <button
                onClick={handleGenerateTodos}
                disabled={generatingTodos}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {generatingTodos ? "생성 중..." : "AI 생성"}
              </button>
            </div>
          </header>

          <div className="border-b border-slate-100 p-4">
            <div className="flex gap-2">
              <input
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !creatingTodo) {
                    handleCreateTodo();
                  }
                }}
                placeholder="새 Todo 추가"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />

              <button
                onClick={handleCreateTodo}
                disabled={creatingTodo}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
              >
                추가
              </button>
            </div>
          </div>

          <section className="flex-1 space-y-3 overflow-y-auto p-4">
            {todoLoading ? (
              <p className="text-sm text-slate-500">Todo를 불러오는 중...</p>
            ) : todos.length === 0 ? (
              <p className="text-sm leading-6 text-slate-500">
                아직 Todo가 없습니다. 직접 추가하거나 AI 생성 버튼을 눌러 시작해보세요.
              </p>
            ) : (
              todos.map((todo) => {
                const isDone = todo.status === "done";

                return (
                  <label
                    key={todo.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-red-200 hover:bg-red-50"
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm font-semibold ${
                          isDone
                            ? "text-slate-400 line-through"
                            : "text-slate-800"
                        }`}
                      >
                        {todo.title}
                      </span>

                      {todo.description && (
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {todo.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
