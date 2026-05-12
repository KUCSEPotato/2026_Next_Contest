"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  confirmTodosApi,
  createTodoApi,
  deleteTodoApi,
  generateAITodosApi,
  getMessagesApi,
  getProjectApi,
  getTodoStateApi,
  getTodosApi,
  sendMessageApi,
  updateTodoApi,
} from "../../../lib/api";
import { useRef } from "react";

const TODO_STAGES = [
  { value: "planning", label: "기획" },
  { value: "design", label: "설계" },
  { value: "development", label: "개발" },
  { value: "verification", label: "검증" },
];

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
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
  const [project, setProject] = useState(null);
  const [todos, setTodos] = useState([]);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoStage, setTodoStage] = useState("planning");
  const [todoLoading, setTodoLoading] = useState(false);
  const [creatingTodo, setCreatingTodo] = useState(false);
  const [generatingTodos, setGeneratingTodos] = useState(false);
  const [confirmingTodos, setConfirmingTodos] = useState(false);
  const [isTodoFinalized, setIsTodoFinalized] = useState(false);
  const [isSelectingMessages, setIsSelectingMessages] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState("");
  const [editingTodoDescription, setEditingTodoDescription] = useState("");
  const [expandedTodoIds, setExpandedTodoIds] = useState([]);

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

      const [projectResult, todosResult, todoStateResult] = await Promise.all([
        getProjectApi(projectId),
        getTodosApi(projectId),
        getTodoStateApi(projectId).catch(() => ({ data: { is_finalized: false } })),
      ]);

      const members = projectResult.data?.members || [];
      setProject(projectResult.data);
      setProjectMembers(members);
      setTodos(Array.isArray(todosResult.data) ? todosResult.data : []);
      setIsTodoFinalized(Boolean(todoStateResult.data?.is_finalized));
    } catch (error) {
      console.error(error);
    } finally {
      setTodoLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const wsBaseUrl = apiBaseUrl.replace(/^http/, "ws");
    const socket = new WebSocket(
      `${wsBaseUrl}/api/v1/projects/${projectId}/todos/ws?token=${token}`
    );

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "todo.snapshot") {
        setTodos(Array.isArray(payload.data) ? payload.data : []);
      }

      if (payload.type === "todo.created") {
        setTodos((prev) => {
          const exists = prev.some((todo) => todo.id === payload.data.id);
          return exists
            ? prev.map((todo) => (todo.id === payload.data.id ? payload.data : todo))
            : [...prev, payload.data];
        });
      }

      if (payload.type === "todo.updated") {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === payload.data.id ? payload.data : todo))
        );
      }

      if (payload.type === "todo.deleted") {
        setTodos((prev) =>
          prev.filter((todo) => todo.id !== payload.data?.todo_id)
        );
      }

      if (payload.type === "todo.state.updated") {
        setIsTodoFinalized(Boolean(payload.data?.is_finalized));
      }
    };

    socket.onerror = (error) => {
      console.error(error);
    };

    return () => {
      socket.close();
    };
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

    if (isTodoFinalized) {
      alert("확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다.");
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
        stage: todoStage,
        status: "todo",
        priority: todos.length + 1,
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

  const handleGenerateTodos = async () => {
    if (!projectId) {
      alert("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    if (isTodoFinalized) {
      alert("확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다.");
      return;
    }

    if (!isLeader) {
      alert("AI Todo 생성은 팀장만 사용할 수 있습니다.");
      return;
    }

    if (
      !confirm(
        selectedMessageIds.length > 0
          ? `선택한 메시지 ${selectedMessageIds.length}개와 프로젝트 정보를 바탕으로 AI Todo를 생성할까요?`
          : "선택한 메시지가 없습니다. 최근 채팅과 프로젝트 정보를 바탕으로 AI Todo를 생성할까요?"
      )
    ) {
      return;
    }

    try {
      setGeneratingTodos(true);

      await generateAITodosApi(projectId, {
        room_id: Number(roomId),
        message_ids: selectedMessageIds,
        limit: 14,
      });
      await loadProjectTodos();
      setIsSelectingMessages(false);
      setSelectedMessageIds([]);
      alert("AI Todo가 생성되었습니다.");
    } catch (error) {
      console.error(error);
      alert("AI Todo 생성에 실패했습니다.");
    } finally {
      setGeneratingTodos(false);
    }
  };

  const isLeader = project?.leader_id === myId;

  const handleConfirmTodos = async () => {
    if (!projectId) {
      alert("프로젝트 정보를 찾을 수 없습니다.");
      return;
    }

    if (isTodoFinalized) return;

    if (
      !confirm(
        "확정하시겠습니까? 진행 관리 페이지에서 수정 가능합니다."
      )
    ) {
      return;
    }

    try {
      setConfirmingTodos(true);
      const result = await confirmTodosApi(projectId);
      setIsTodoFinalized(Boolean(result.data?.is_finalized));
      alert("Todo 체크리스트가 확정되었습니다.");
    } catch (error) {
      console.error(error);
      alert("Todo 확정에 실패했습니다.");
    } finally {
      setConfirmingTodos(false);
    }
  };

  const toggleSelectedMessage = (messageId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const startEditingTodo = (todo) => {
    if (isTodoFinalized) {
      alert("확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다.");
      return;
    }

    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title || "");
    setEditingTodoDescription(todo.description || "");
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditingTodoTitle("");
    setEditingTodoDescription("");
  };

  const handleSaveTodoEdit = async (todo) => {
    if (!projectId) return;
    if (isTodoFinalized) {
      alert("확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다.");
      return;
    }

    if (!editingTodoTitle.trim()) {
      alert("Todo 제목을 입력해주세요.");
      return;
    }

    try {
      await updateTodoApi(projectId, todo.id, {
        title: editingTodoTitle.trim(),
        description: editingTodoDescription.trim() || null,
      });
      cancelEditingTodo();
      await loadProjectTodos();
    } catch (error) {
      console.error(error);
      alert("Todo 수정에 실패했습니다.");
    }
  };

  const handleDeleteTodo = async (todo) => {
    if (!projectId) return;
    if (isTodoFinalized) {
      alert("확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다.");
      return;
    }

    if (!confirm(`"${todo.title}" 항목을 삭제할까요?`)) {
      return;
    }

    try {
      await deleteTodoApi(projectId, todo.id);
      setExpandedTodoIds((prev) => prev.filter((id) => id !== todo.id));
      if (editingTodoId === todo.id) {
        cancelEditingTodo();
      }
      await loadProjectTodos();
    } catch (error) {
      console.error(error);
      alert("Todo 삭제에 실패했습니다.");
    }
  };

  const toggleTodoDetail = (todoId) => {
    setExpandedTodoIds((prev) =>
      prev.includes(todoId)
        ? prev.filter((id) => id !== todoId)
        : [...prev, todoId]
    );
  };

  const todoGroups = groupTodosByStage(todos);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto grid h-[80vh] w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600">
                  Room #{roomId}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  채팅 메시지
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  프로젝트 멤버들과 메시지를 주고받을 수 있습니다.
                </p>
              </div>

              <button
                onClick={() => {
                  setIsSelectingMessages((prev) => !prev);
                  setSelectedMessageIds([]);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isSelectingMessages
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                }`}
              >
                {isSelectingMessages ? "범위 선택 종료" : "AI 반영 범위 선택"}
              </button>
            </div>

            {isSelectingMessages && (
              <p className="mt-3 text-xs text-slate-500">
                AI가 참고할 메시지를 선택하세요. 선택하지 않으면 최근 채팅 전체를 기준으로 생성합니다.
                현재 {selectedMessageIds.length}개 선택됨
              </p>
            )}
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
                  className={`flex items-start gap-2 ${
                    message.sender_id === myId ? "justify-end" : "justify-start"
                  }`}
                >
                  {isSelectingMessages && message.sender_id !== myId && (
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.includes(message.id)}
                      onChange={() => toggleSelectedMessage(message.id)}
                      className="mt-3 h-4 w-4 accent-red-600"
                    />
                  )}

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

                  {isSelectingMessages && message.sender_id === myId && (
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.includes(message.id)}
                      onChange={() => toggleSelectedMessage(message.id)}
                      className="mt-3 h-4 w-4 accent-red-600"
                    />
                  )}
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
                disabled={generatingTodos || !isLeader || isTodoFinalized}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
                title={
                  isTodoFinalized
                    ? "확정된 체크리스트는 진행 관리 페이지에서 수정할 수 있습니다."
                    : isLeader
                    ? "선택한 채팅 범위와 프로젝트 정보를 바탕으로 Todo를 생성합니다."
                    : "AI Todo 생성은 팀장만 사용할 수 있습니다."
                }
              >
                {generatingTodos ? "생성 중..." : "AI 생성"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {isTodoFinalized ? (
                <p className="text-xs text-slate-500">
                  확정된 체크리스트입니다. 수정/추가는{" "}
                  <button
                    type="button"
                    onClick={() => projectId && router.push(`/projects/${projectId}/manage`)}
                    disabled={!projectId}
                    className="font-semibold text-red-600 underline-offset-2 transition hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    진행 관리 페이지
                  </button>
                  에서 할 수 있습니다.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  채팅방에서 초안을 만들고 확정하면 진행 관리 페이지로 넘깁니다.
                </p>
              )}

              {!isTodoFinalized && (
                <button
                  onClick={handleConfirmTodos}
                  disabled={confirmingTodos}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {confirmingTodos ? "확정 중..." : "확정"}
                </button>
              )}
            </div>
            {!isLeader && (
              <p className="mt-2 text-xs text-slate-500">
                AI 생성은 팀장만 사용할 수 있습니다.
              </p>
            )}
          </header>

          {!isTodoFinalized && (
            <div className="border-b border-slate-100 p-4">
              <div className="grid gap-2">
                <select
                  value={todoStage}
                  onChange={(e) => setTodoStage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  {TODO_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
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
            </div>
          )}

          <section className="flex-1 space-y-3 overflow-y-auto p-4">
            {todoLoading ? (
              <p className="text-sm text-slate-500">Todo를 불러오는 중...</p>
            ) : todos.length === 0 ? (
              <p className="text-sm leading-6 text-slate-500">
                아직 Todo가 없습니다. 직접 추가하거나 AI 생성 버튼을 눌러 시작해보세요.
              </p>
            ) : (
              todoGroups.map((group) => (
                <div key={group.stage} className="space-y-2">
                  <div className="sticky top-0 z-10 bg-white/95 py-1 backdrop-blur">
                    <h3 className="text-xs font-bold text-red-600">
                      {group.label}
                    </h3>
                  </div>

                  {group.items.map(({ todo }) => {
                    const isDone = todo.status === "done";
                    const isEditing = editingTodoId === todo.id;
                    const description = getVisibleTodoDescription(todo);
                    const isExpanded = expandedTodoIds.includes(todo.id);

                    return (
                      <div
                        key={todo.id}
                        className="rounded-xl border border-slate-200 px-3 py-2 transition hover:border-red-200 hover:bg-red-50"
                      >
                        <div className="flex gap-2">
                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  value={editingTodoTitle}
                                  onChange={(e) =>
                                    setEditingTodoTitle(e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                                />

                                <textarea
                                  value={editingTodoDescription}
                                  onChange={(e) =>
                                    setEditingTodoDescription(e.target.value)
                                  }
                                  className="min-h-20 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                                  placeholder="세부 내용"
                                />

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveTodoEdit(todo)}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                                  >
                                    저장
                                  </button>

                                  <button
                                    onClick={cancelEditingTodo}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    description && toggleTodoDetail(todo.id)
                                  }
                                  className={`block w-full text-left text-sm font-semibold leading-5 ${
                                    isDone
                                      ? "text-slate-400 line-through"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {todo.title}
                                </button>

                                {description && isExpanded && (
                                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                                    {description}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="mt-2 flex items-center justify-between gap-2 pl-6">
                            {description ? (
                              <button
                                onClick={() => toggleTodoDetail(todo.id)}
                                className="text-xs font-semibold text-slate-400 hover:text-red-600"
                              >
                                {isExpanded ? "접기" : "상세"}
                              </button>
                            ) : (
                              <span />
                            )}

                            {!isTodoFinalized && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEditingTodo(todo)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600"
                              >
                                수정
                              </button>

                              <button
                                onClick={() => handleDeleteTodo(todo)}
                                className="rounded-lg border border-red-100 px-2 py-1 text-xs font-semibold text-red-500 hover:border-red-300 hover:bg-red-50"
                              >
                                삭제
                              </button>
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function groupTodosByStage(todos) {
  const groupMap = new Map(
    TODO_STAGES.map((stage) => [
      stage.value,
      { stage: stage.value, label: stage.label, items: [] },
    ])
  );
  const extraGroups = [];

  todos.forEach((todo, index) => {
    const stage = normalizeTodoStage(todo.stage);

    if (!groupMap.has(stage)) {
      const group = { stage, label: stage, items: [] };
      groupMap.set(stage, group);
      extraGroups.push(group);
    }

    groupMap.get(stage).items.push({ todo, index });
  });

  return [
    ...TODO_STAGES.map((stage) => groupMap.get(stage.value)).filter(
      (group) => group.items.length > 0
    ),
    ...extraGroups.filter((group) => group.items.length > 0),
  ];
}

function normalizeTodoStage(stage) {
  const value = String(stage || "").trim();

  if (!value || value === "planning" || value.includes("기획")) return "planning";
  if (value === "design" || value.includes("설계")) return "design";
  if (value === "development" || value.includes("개발")) return "development";
  if (value === "verification" || value.includes("검증")) return "verification";

  return value;
}

function getVisibleTodoDescription(todo) {
  const description = String(todo?.description || "").trim();

  if (
    description ===
    "AI가 선택한 채팅 범위와 프로젝트 상세 정보를 바탕으로 생성한 Todo입니다."
  ) {
    return "";
  }

  return description;
}
