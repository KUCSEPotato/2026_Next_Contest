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
  createReportApi,
  sendMessageApi,
  updateTodoApi,
} from "../../../lib/api";
import { useDialog, useToast } from "../../../components/AppFeedback";
import { useRef } from "react";

const TODO_STAGES = [
  { value: "planning", label: "기획" },
  { value: "design", label: "설계" },
  { value: "development", label: "개발" },
  { value: "verification", label: "검증" },
];

const CHAT_READ_COUNTS_STORAGE_KEY = "devory_chat_read_counts";

const getStoredChatReadCounts = () => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_COUNTS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const markChatRoomRead = (roomId, messageCount) => {
  if (typeof window === "undefined" || !roomId) return;

  const readCounts = getStoredChatReadCounts();
  readCounts[String(roomId)] = messageCount;
  localStorage.setItem(CHAT_READ_COUNTS_STORAGE_KEY, JSON.stringify(readCounts));
};

const getDoneAssignmentNames = (todo) =>
  (todo?.assignments || [])
    .filter((assignment) => assignment.is_done)
    .map(
      (assignment) =>
        assignment.nickname ||
        assignment.user?.nickname ||
        assignment.name ||
        assignment.user?.name ||
        `User #${assignment.user_id}`
    );

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { prompt, confirm } = useDialog();
  const roomId = params.roomId;
  const projectId = searchParams.get("projectId");
  const bottomRef = useRef(null);
  const todoListRef = useRef(null);

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
  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [todoDropTarget, setTodoDropTarget] = useState(null);
  const [reorderingTodos, setReorderingTodos] = useState(false);
  const pendingTodoScrollTopRef = useRef(null);

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

  useEffect(() => {
    markChatRoomRead(roomId, messages.length);
  }, [messages.length, roomId]);

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

    const ok = await confirm({
      title: "AI Todo를 생성할까요?",
      message: selectedMessageIds.length > 0
        ? `선택한 메시지 ${selectedMessageIds.length}개와 프로젝트 정보를 바탕으로 Todo를 만들어요.`
        : "선택한 메시지가 없습니다. 최근 채팅과 프로젝트 정보를 바탕으로 Todo를 만들어요.",
      confirmText: "생성하기",
      cancelText: "취소",
    });
    if (!ok) {
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

    const ok = await confirm({
      title: "Todo 체크리스트를 확정할까요?",
      message: "확정 후에는 진행 관리 페이지에서 수정할 수 있어요.",
      confirmText: "확정하기",
      cancelText: "취소",
    });
    if (!ok) {
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

    const ok = await confirm({
      title: "Todo를 삭제할까요?",
      message: `"${todo.title}" 항목을 삭제합니다.`,
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) {
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

  const handleTodoDragStart = (event, todoId) => {
    if (isTodoFinalized || editingTodoId) {
      event.preventDefault();
      return;
    }

    setDraggedTodoId(todoId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(todoId));
  };

  const handleTodoListDragOver = (event) => {
    if (!draggedTodoId || isTodoFinalized || editingTodoId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const container = todoListRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const threshold = 64;
    const maxSpeed = 28;

    const distanceToTop = event.clientY - rect.top;
    const distanceToBottom = rect.bottom - event.clientY;

    let scrollDelta = 0;

    if (distanceToTop < threshold) {
      const intensity = Math.max(0, threshold - distanceToTop) / threshold;
      scrollDelta = -Math.max(8, intensity * maxSpeed);
    } else if (distanceToBottom < threshold) {
      const intensity = Math.max(0, threshold - distanceToBottom) / threshold;
      scrollDelta = Math.max(8, intensity * maxSpeed);
    }

    if (scrollDelta !== 0) {
      container.scrollTop += scrollDelta;
    }
  };

  const restoreTodoScrollPosition = useCallback(() => {
    const container = todoListRef.current;
    const pendingScrollTop = pendingTodoScrollTopRef.current;
    if (!container || pendingScrollTop === null) return;

    container.scrollTop = pendingScrollTop;
    pendingTodoScrollTopRef.current = null;
  }, []);

  const handleTodoDragEnd = () => {
    setDraggedTodoId(null);
    setTodoDropTarget(null);
  };

  const handleTodoDragOver = (event, targetTodo) => {
    if (draggedTodoId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }

    if (!draggedTodoId || draggedTodoId === targetTodo.id || isTodoFinalized || editingTodoId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";

    setTodoDropTarget((currentTarget) =>
      currentTarget?.todoId === targetTodo.id && currentTarget?.position === position
        ? currentTarget
        : { todoId: targetTodo.id, position }
    );
  };

  const handleTodoDrop = async (targetTodo, position) => {
    if (!projectId || isTodoFinalized || editingTodoId || !draggedTodoId) {
      handleTodoDragEnd();
      return;
    }

    if (draggedTodoId === targetTodo.id) {
      handleTodoDragEnd();
      return;
    }

    const draggedTodo = todos.find((todo) => todo.id === draggedTodoId);
    if (!draggedTodo) {
      handleTodoDragEnd();
      return;
    }

    const currentTodos = groupTodosByStage(todos).flatMap((group) =>
      group.items.map(({ todo }) => todo)
    );
    const fromIndex = currentTodos.findIndex((todo) => todo.id === draggedTodoId);

    if (fromIndex < 0) {
      handleTodoDragEnd();
      return;
    }

    const reorderedTodos = [...currentTodos];
    const [movedTodo] = reorderedTodos.splice(fromIndex, 1);
    const targetIndex = reorderedTodos.findIndex((todo) => todo.id === targetTodo.id);

    if (targetIndex < 0) {
      handleTodoDragEnd();
      return;
    }

    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    reorderedTodos.splice(insertIndex, 0, {
      ...movedTodo,
      stage: targetTodo.stage,
    });

    const normalizedTodos = reorderedTodos.map((todo, index) => ({
      ...todo,
      priority: index + 1,
    }));
    const changedTodos = normalizedTodos.filter((nextTodo) => {
      const prevTodo = currentTodos.find((todo) => todo.id === nextTodo.id);
      return prevTodo?.priority !== nextTodo.priority || prevTodo?.stage !== nextTodo.stage;
    });

    setTodos(normalizedTodos);
    handleTodoDragEnd();

    try {
      setReorderingTodos(true);
      pendingTodoScrollTopRef.current = todoListRef.current?.scrollTop ?? null;
      for (const todo of changedTodos) {
        const prevTodo = currentTodos.find((item) => item.id === todo.id);
        const payload = {};

        if (prevTodo?.priority !== todo.priority) {
          payload.priority = todo.priority;
        }

        if (prevTodo?.stage !== todo.stage) {
          payload.stage = todo.stage;
        }

        await updateTodoApi(projectId, todo.id, payload);
      }
      await loadProjectTodos();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          restoreTodoScrollPosition();
        });
      });
    } catch (error) {
      console.error(error);
      setTodos(currentTodos);
      alert("Todo 순서 변경에 실패했습니다.");
    } finally {
      setReorderingTodos(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          restoreTodoScrollPosition();
        });
      });
    }
  };

  const toggleTodoDetail = (todoId) => {
    setExpandedTodoIds((prev) =>
      prev.includes(todoId)
        ? prev.filter((id) => id !== todoId)
        : [...prev, todoId]
    );
  };

  const handleReportChatRoom = async () => {
    const reasonInput = await prompt({
      title: "채팅방 신고",
      message: "관리자가 확인할 수 있도록 신고 사유를 입력해주세요.",
      placeholder: "문제가 되는 대화나 상황을 입력하세요.",
      confirmText: "신고하기",
      required: true,
      multiline: true,
      tone: "danger",
    });
    if (reasonInput === null) return;

    try {
      await createReportApi({
        target_type: "chat",
        target_id: Number(roomId),
        reason: reasonInput.trim(),
      });
      toast.success("신고가 접수되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신고 접수에 실패했습니다.");
    }
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

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleReportChatRoom}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
                >
                  채팅방 신고
                </button>
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

          <section
            ref={todoListRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 pb-4"
            onDragOver={(event) => {
              handleTodoListDragOver(event);
              if (draggedTodoId) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              if (!draggedTodoId || !todoDropTarget) return;
              event.preventDefault();
              const targetTodo = todos.find((todo) => todo.id === todoDropTarget.todoId);
              if (targetTodo) {
                handleTodoDrop(targetTodo, todoDropTarget.position);
              } else {
                handleTodoDragEnd();
              }
            }}
          >
            {!isTodoFinalized && todos.length > 1 && (
              <p className="pt-3 text-xs text-slate-400">
                Todo 카드를 드래그해서 순서를 바꿀 수 있습니다.
                {reorderingTodos ? " 저장 중..." : ""}
              </p>
            )}
            {todoLoading ? (
              <p className="pt-4 text-sm text-slate-500">Todo를 불러오는 중...</p>
            ) : todos.length === 0 ? (
              <p className="pt-4 text-sm leading-6 text-slate-500">
                아직 Todo가 없습니다. 직접 추가하거나 AI 생성 버튼을 눌러 시작해보세요.
              </p>
            ) : (
              todoGroups.map((group) => (
                <div key={group.stage} className="space-y-2">
                  <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 py-2 backdrop-blur">
                    <h3 className="text-xs font-bold text-red-600">
                      {group.label}
                    </h3>
                  </div>

                  {group.items.map(({ todo }) => {
                    const isDone = todo.status === "done";
                    const isEditing = editingTodoId === todo.id;
                    const description = getVisibleTodoDescription(todo);
                    const isExpanded = expandedTodoIds.includes(todo.id);
                    const doneAssignmentNames = getDoneAssignmentNames(todo);

                    return (
                      <div
                        key={todo.id}
                        draggable={!isTodoFinalized && !isEditing && !reorderingTodos}
                        onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                        onDragOver={(event) => handleTodoDragOver(event, todo)}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          const rect = event.currentTarget.getBoundingClientRect();

                          const position =
                            event.clientY < rect.top + rect.height / 2 ? "before" : "after";

                          handleTodoDrop(todo, position);
                        }}
                        onDragEnd={handleTodoDragEnd}
                        className={`relative rounded-xl border px-3 py-2 transition ${
                          draggedTodoId === todo.id
                            ? "border-red-300 bg-red-50 opacity-60"
                            : "border-slate-200 hover:border-red-200 hover:bg-red-50"
                        } ${!isTodoFinalized && !isEditing ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        {todoDropTarget?.todoId === todo.id && (
                          <div
                            className={`pointer-events-none absolute left-2 right-2 z-20 h-1 rounded-full bg-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.9)] ${
                              todoDropTarget.position === "before" ? "-top-2" : "-bottom-2"
                            }`}
                          />
                        )}
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

                                {doneAssignmentNames.length > 0 && (
                                  <p className="mt-2 text-xs font-semibold text-red-600">
                                    수행: {doneAssignmentNames.join(", ")}
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
                                onMouseDown={(e) => e.stopPropagation()}
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
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => startEditingTodo(todo)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600"
                              >
                                수정
                              </button>

                              <button
                                onMouseDown={(e) => e.stopPropagation()}
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
