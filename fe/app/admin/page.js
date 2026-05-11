"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminOverviewApi,
  getAdminPaymentsApi,
  getAdminProjectsApi,
  getAdminReportsApi,
  getAdminUsersApi,
  updateAdminPaymentApi,
  updateAdminReportApi,
  updateAdminUserStatusApi,
} from "../../lib/api";
import { getStoredUser } from "../../lib/auth";

const TABS = [
  { id: "reports", label: "신고" },
  { id: "payments", label: "결제" },
  { id: "users", label: "사용자" },
  { id: "projects", label: "프로젝트" },
];

const REPORT_STATUSES = ["open", "reviewing", "resolved", "rejected"];
const USER_ROLES = ["user", "leader", "admin"];

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

  async function loadAdminData() {
    try {
      setLoading(true);
      setError("");
      const [overviewResult, usersResult, projectsResult, reportsResult, paymentsResult] =
        await Promise.all([
          getAdminOverviewApi(),
          getAdminUsersApi(),
          getAdminProjectsApi(),
          getAdminReportsApi(),
          getAdminPaymentsApi(),
        ]);

      setOverview(overviewResult.data || null);
      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      setReports(reportsResult.data || []);
      setPayments(paymentsResult.data || []);
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
  }

  useEffect(() => {
    queueMicrotask(() => {
      const storedUser = getStoredUser();
      if (storedUser?.role !== "admin") {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      loadAdminData();
    });
  }, []);

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
                      신고 #{report.id}
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
                        {report.target_user_id ? `User #${report.target_user_id}` : ""}
                        {report.target_project_id ? `Project #${report.target_project_id}` : ""}
                        {!report.target_user_id && !report.target_project_id ? "-" : ""}
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
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
