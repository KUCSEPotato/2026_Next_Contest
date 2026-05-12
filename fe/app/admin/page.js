"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminNoticeApi,
  grantAdminUserCoinsApi,
  revokeAdminUserCoinsApi,
  getAdminOverviewApi,
  getAdminPaymentsApi,
  getAdminProjectsApi,
  getAdminReportsApi,
  getAdminUsersApi,
  updateAdminPaymentApi,
  updateAdminReportApi,
  updateAdminUserStatusApi,
  getAdminMyPostsApi,
  adminUpdatePostApi,
  adminDeletePostApi,
} from "../../lib/api";
import { getStoredUser, getToken, loadCurrentUser } from "../../lib/auth";

const TABS = [
  { id: "reports", label: "신고" },
  { id: "payments", label: "결제" },
  { id: "users", label: "사용자" },
  { id: "notices", label: "공지" },
  { id: "projects", label: "프로젝트" },
];

const REPORT_STATUSES = ["open", "reviewing", "resolved", "rejected"];
const USER_ROLES = ["user", "leader", "admin"];
const REPORT_SCOPES = [
  { value: "all", label: "전체" },
  { value: "user", label: "사용자" },
  { value: "project", label: "프로젝트" },
  { value: "post", label: "게시글" },
  { value: "chat", label: "채팅" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortJson(value) {
  if (!value) return "-";
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return "-";
  }
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("reports");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userActiveFilter, setUserActiveFilter] = useState("");
  const [reportScope, setReportScope] = useState("all");
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    isPinned: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingKey, setProcessingKey] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(null);

  const openReports = useMemo(
    () => reports.filter((report) => report.status === "open"),
    [reports]
  );
  const pendingPayments = useMemo(
    () => payments.filter((payment) => !payment.processed_at),
    [payments]
  );

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [overviewResult, usersResult, projectsResult, reportsResult, paymentsResult] =
        await Promise.all([
          getAdminOverviewApi(),
          getAdminUsersApi({
            q: userSearch.trim() || undefined,
            role: userRoleFilter || undefined,
            is_active:
              userActiveFilter === ""
                ? undefined
                : userActiveFilter === "true",
          }),
          getAdminProjectsApi(),
          getAdminReportsApi({ scope: reportScope }),
          getAdminPaymentsApi(),
          getAdminMyPostsApi(),
        ]);

      setOverview(overviewResult.data || null);
      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      setReports(reportsResult.data || []);
      setPayments(paymentsResult.data || []);
      setAdminPosts((paymentsResult && paymentsResult.data) || (typeof paymentsResult === 'undefined' ? [] : []));
      // above is placeholder; set adminPosts from the correct result below
      setAdminPosts((await getAdminMyPostsApi().then(r=>r.data).catch(()=>[])) || []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "관리자 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [reportScope, userActiveFilter, userSearch, userRoleFilter]);

  useEffect(() => {
    let cancelled = false;

    const initializeAdmin = async () => {
      let currentUser = getStoredUser();

      if (getToken() && currentUser?.role !== "admin") {
        try {
          currentUser = await loadCurrentUser();
        } catch {
          currentUser = getStoredUser();
        }
      }

      if (cancelled) return;

      if (currentUser?.role !== "admin") {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      loadAdminData();
    };

    queueMicrotask(initializeAdmin);

    return () => {
      cancelled = true;
    };
  }, [loadAdminData]);

  async function handleRefreshUsersAndReports() {
    await loadAdminData();
  }

  async function handleReportStatus(reportId, status) {
    try {
      setProcessingKey(`report-${reportId}`);
      await updateAdminReportApi(reportId, { status });
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId ? { ...report, status } : report
        )
      );
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              reports_open:
                status === "open"
                  ? prev.reports_open
                  : Math.max(0, prev.reports_open - 1),
            }
          : prev
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "신고 처리에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handlePaymentProcessed(eventId, processed) {
    try {
      setProcessingKey(`payment-${eventId}`);
      const result = await updateAdminPaymentApi(eventId, { processed });
      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === eventId
            ? { ...payment, processed_at: result.data?.processed_at || null }
            : payment
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "결제 이벤트 처리에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleUserActive(userId, isActive) {
    try {
      setProcessingKey(`user-${userId}`);
      await updateAdminUserStatusApi(userId, { is_active: isActive });
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, is_active: isActive } : user
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "사용자 상태 변경에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleUserRole(userId, role) {
    const targetUser = users.find((user) => user.id === userId);
    const message =
      role === "admin"
        ? `${targetUser?.nickname || `User #${userId}`} 사용자를 관리자로 승격할까요?`
        : `${targetUser?.nickname || `User #${userId}`} 사용자의 권한을 ${role}로 변경할까요?`;

    if (!window.confirm(message)) return;

    try {
      setProcessingKey(`user-role-${userId}`);
      await updateAdminUserStatusApi(userId, { role });
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role } : user
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "사용자 권한 변경에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleGrantCoins(userId) {
    const targetUser = users.find((user) => user.id === userId);
    const amountInput = window.prompt(
      `${targetUser?.nickname || `User #${userId}`}에게 지급할 코인 수를 입력하세요.`,
      "100"
    );

    if (amountInput === null) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("코인 수는 1 이상의 숫자여야 합니다.");
      return;
    }

    const noteInput = window.prompt("지급 사유를 입력하세요. (선택)", "") || "";

    try {
      setProcessingKey(`coin-${userId}`);
      const result = await grantAdminUserCoinsApi(userId, {
        amount,
        note: noteInput.trim() || undefined,
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, coin_balance: result.data?.coin_balance ?? user.coin_balance }
            : user
        )
      );

      alert("코인을 지급했습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "코인 지급에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleCreateNotice() {
    if (!noticeForm.title.trim()) {
      alert("공지 제목을 입력해주세요.");
      return;
    }

    if (!noticeForm.content.trim()) {
      alert("공지 내용을 입력해주세요.");
      return;
    }

    try {
      setProcessingKey("notice-create");
      await createAdminNoticeApi({
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        is_pinned: noticeForm.isPinned,
      });

      setNoticeForm({ title: "", content: "", isPinned: true });
      alert("공지글을 작성했습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "공지 작성에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleEditAdminPost(postId) {
    const post = adminPosts.find((p) => p.id === postId);
    if (!post) return;

    const newTitle = window.prompt("제목을 입력하세요", post.title);
    if (newTitle === null) return;
    const newContent = window.prompt("내용을 입력하세요", post.content);
    if (newContent === null) return;

    try {
      setProcessingKey(`admin-post-edit-${postId}`);
      await adminUpdatePostApi(postId, { title: newTitle.trim(), content: newContent.trim() });
      setAdminPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, title: newTitle, content: newContent } : p)));
      alert("게시물을 수정했습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "게시물 수정에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleDeleteAdminPost(postId) {
    if (!window.confirm("정말로 삭제하시겠습니까? (soft delete)")) return;
    try {
      setProcessingKey(`admin-post-delete-${postId}`);
      await adminDeletePostApi(postId);
      setAdminPosts((prev) => prev.filter((p) => p.id !== postId));
      alert("게시물을 삭제했습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "게시물 삭제에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-600">Admin only</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            관리자 권한이 필요합니다
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            어드민 페이지는 admin 계정으로 로그인한 사용자만 접근할 수 있습니다.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            로그인으로 이동
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              운영 관리
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              신고, 결제 이벤트, 사용자 상태, 프로젝트 현황을 한 곳에서 관리합니다.
            </p>
          </div>
          <button
            onClick={loadAdminData}
            disabled={loading}
            className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            새로고침
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="사용자" value={overview?.users_total} sub={`${overview?.users_active ?? 0} active`} />
          <Metric label="프로젝트" value={overview?.projects_total} sub={`${overview?.projects_active ?? 0} active`} />
          <Metric label="미처리 신고" value={overview?.reports_open} sub={`${overview?.reports_total ?? 0} total`} tone="danger" />
          <Metric label="결제 이벤트" value={overview?.payment_events_total} sub={`${overview?.payment_events_pending ?? 0} pending`} tone="warning" />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="처리 대기 신고" description={`${openReports.length}건`}>
            <div className="divide-y divide-slate-100">
              {openReports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      신고 #{report.id} · {report.target_scope || "user"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {report.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReportStatus(report.id, "resolved")}
                    disabled={processingKey === `report-${report.id}`}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    해결
                  </button>
                </div>
              ))}
              {openReports.length === 0 && <EmptyLine text="대기 중인 신고가 없습니다." />}
            </div>
          </Panel>

          <Panel title="처리 대기 결제" description={`${pendingPayments.length}건`}>
            <div className="divide-y divide-slate-100">
              {pendingPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {payment.provider} · {payment.event_type}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {payment.provider_event_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePaymentProcessed(payment.id, true)}
                    disabled={processingKey === `payment-${payment.id}`}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    처리
                  </button>
                </div>
              ))}
              {pendingPayments.length === 0 && <EmptyLine text="대기 중인 결제 이벤트가 없습니다." />}
            </div>
          </Panel>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {activeTab === "reports" && (
              <div className="p-4">
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">신고 범위</label>
                    <select
                      value={reportScope}
                      onChange={(e) => setReportScope(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {REPORT_SCOPES.map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleRefreshUsersAndReports}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    필터 적용
                  </button>
                </div>

                <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <Th>ID</Th>
                    <Th>대상</Th>
                    <Th>사유</Th>
                    <Th>상태</Th>
                    <Th>처리</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <Td>#{report.id}</Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {report.target_scope || "user"}
                          </p>
                          <p>
                            {report.target_user_id ? `User #${report.target_user_id}` : ""}
                            {report.target_project_id ? `Project #${report.target_project_id}` : ""}
                            {report.target_post_id ? `Post #${report.target_post_id}` : ""}
                            {report.target_chat_room_id ? `Chat Room #${report.target_chat_room_id}` : ""}
                            {!report.target_user_id && !report.target_project_id && !report.target_post_id && !report.target_chat_room_id ? "-" : ""}
                          </p>
                        </div>
                      </Td>
                      <Td className="max-w-md">
                        <span className="line-clamp-2">{report.reason}</span>
                      </Td>
                      <Td><StatusBadge value={report.status} /></Td>
                      <Td>
                        <select
                          value={report.status}
                          onChange={(e) => handleReportStatus(report.id, e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {REPORT_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}

            {activeTab === "payments" && (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <Th>ID</Th>
                    <Th>Provider</Th>
                    <Th>Event</Th>
                    <Th>Payload</Th>
                    <Th>Processed</Th>
                    <Th>처리</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td>#{payment.id}</Td>
                      <Td>{payment.provider}</Td>
                      <Td>{payment.event_type}</Td>
                      <Td className="max-w-md"><span className="line-clamp-2">{shortJson(payment.payload)}</span></Td>
                      <Td>{formatDate(payment.processed_at)}</Td>
                      <Td>
                        <button
                          onClick={() => handlePaymentProcessed(payment.id, !payment.processed_at)}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {payment.processed_at ? "해제" : "처리"}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "users" && (
              <div className="p-4">
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="min-w-64 flex-1">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">검색</label>
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="이메일 또는 닉네임"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Role</label>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">전체</option>
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">활성 상태</label>
                    <select
                      value={userActiveFilter}
                      onChange={(e) => setUserActiveFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">전체</option>
                      <option value="true">활성</option>
                      <option value="false">비활성</option>
                    </select>
                  </div>
                  <button
                    onClick={handleRefreshUsersAndReports}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    검색
                  </button>
                </div>

                <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <Th>ID</Th>
                    <Th>계정</Th>
                    <Th>Role</Th>
                    <Th>Coin</Th>
                    <Th>Status</Th>
                    <Th>처리</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <Td>#{user.id}</Td>
                      <Td>
                        <p className="font-semibold text-slate-900">{user.nickname}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </Td>
                      <Td>{user.role}</Td>
                      <Td>{user.coin_balance}</Td>
                      <Td><StatusBadge value={user.is_active ? "active" : "inactive"} /></Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleUserRole(user.id, e.target.value)}
                            disabled={processingKey === `user-role-${user.id}`}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {USER_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUserActive(user.id, !user.is_active)}
                            disabled={processingKey === `user-${user.id}`}
                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {user.is_active ? "정지" : "복구"}
                          </button>
                          <button
                            onClick={() => handleGrantCoins(user.id)}
                            disabled={processingKey === `coin-${user.id}`}
                            className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            코인 지급
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}

            {activeTab === "notices" && (
              <div className="p-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-base font-bold text-slate-950">공지 작성</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    작성된 공지는 커뮤니티의 공지 게시글로 등록됩니다.
                  </p>

                  <div className="mt-4 space-y-3">
                    <input
                      value={noticeForm.title}
                      onChange={(e) =>
                        setNoticeForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="공지 제목"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <textarea
                      value={noticeForm.content}
                      onChange={(e) =>
                        setNoticeForm((prev) => ({ ...prev, content: e.target.value }))
                      }
                      placeholder="공지 내용을 입력하세요."
                      rows={8}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={noticeForm.isPinned}
                        onChange={(e) =>
                          setNoticeForm((prev) => ({ ...prev, isPinned: e.target.checked }))
                        }
                      />
                      상단 고정
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setNoticeForm({ title: "", content: "", isPinned: true })}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        초기화
                      </button>
                      <button
                        onClick={handleCreateNotice}
                        disabled={processingKey === "notice-create"}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        공지 작성
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="text-base font-bold text-slate-950">내가 작성한 공지/이벤트</h2>
                  <p className="mt-1 text-sm text-slate-500">관리자 계정으로 작성한 공지 및 이벤트 글을 수정하거나 삭제할 수 있습니다.</p>
                  <div className="mt-4 divide-y divide-slate-100">
                    {adminPosts.length === 0 && <EmptyLine text="작성한 공지/이벤트 글이 없습니다." />}
                    {adminPosts.map((p) => (
                      <div key={p.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{p.title} · {p.category}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.content}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditAdminPost(p.id)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">수정</button>
                          <button onClick={() => handleDeleteAdminPost(p.id)} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "projects" && (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <Th>ID</Th>
                    <Th>제목</Th>
                    <Th>상태</Th>
                    <Th>리더</Th>
                    <Th>분야</Th>
                    <Th>생성일</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <Td>#{project.id}</Td>
                      <Td className="font-semibold text-slate-900">{project.title}</Td>
                      <Td><StatusBadge value={project.deleted_at ? "deleted" : project.status} /></Td>
                      <Td>User #{project.leader_id}</Td>
                      <Td>{project.category || "-"}</Td>
                      <Td>{formatDate(project.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, sub, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value ?? "-"}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <span className="text-xs font-semibold text-slate-500">{description}</span>
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ text }) {
  return <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
}

function Th({ children }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top text-slate-700 ${className}`}>{children}</td>;
}

function StatusBadge({ value }) {
  const normalized = String(value || "-");
  const tone =
    ["open", "inactive", "deleted"].includes(normalized)
      ? "bg-red-50 text-red-700"
      : ["pending", "reviewing", "planning"].includes(normalized)
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {normalized}
    </span>
  );
}
