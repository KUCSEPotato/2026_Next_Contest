"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminNoticeApi,
  getAdminCoinPurchaseRequestsApi,
  grantAdminUserCoinsApi,
  revokeAdminUserCoinsApi,
  getAdminOverviewApi,
  getAdminPaymentsApi,
  getAdminProjectsApi,
  getAdminReportsApi,
  getAdminUsersApi,
  getAdminPostsApi,
  updateAdminPaymentApi,
  updateAdminCoinPurchaseRequestApi,
  updateAdminReportApi,
  updateAdminUserStatusApi,
  getAdminMyPostsApi,
  adminUpdatePostApi,
  adminDeletePostApi,
  adminTakedownPostApi,
  adminTakedownCommentApi,
  adminTakedownIdeaApi,
  adminTakedownProjectApi,
} from "../../lib/api";
import { getStoredUser, getToken, loadCurrentUser } from "../../lib/auth";
import { useDialog, useToast } from "../../components/AppFeedback";

const TABS = [
  { id: "reports", label: "신고" },
  { id: "payments", label: "결제" },
  { id: "users", label: "사용자" },
  { id: "notices", label: "공지" },
  { id: "posts", label: "게시글" },
  { id: "projects", label: "프로젝트" },
];

const REPORT_STATUSES = ["open", "reviewing", "resolved", "rejected"];
const USER_ROLES = ["user", "leader", "admin"];
const USER_PLANS = [
  { value: "FREE", label: "무료" },
  { value: "PLUS_MONTHLY", label: "Plus 월 구독" },
  { value: "PRO_MONTHLY", label: "Pro 월 구독" },
  { value: "PASS_1D", label: "1일권" },
  { value: "PASS_3D", label: "3일권" },
  { value: "PASS_7D", label: "7일권" },
];
const COIN_REQUEST_STATUSES = {
  pending: "확인 대기",
  approved: "승인",
  rejected: "거절",
};
const REPORT_SCOPES = [
  { value: "all", label: "전체" },
  { value: "user", label: "사용자" },
  { value: "project", label: "프로젝트" },
  { value: "post", label: "게시글" },
  { value: "comment", label: "댓글" },
  { value: "chat", label: "채팅" },
  { value: "review", label: "평가" },
  { value: "adoption_request", label: "팀장 넘겨주기" },
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

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
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
  const toast = useToast();
  const { confirm, prompt } = useDialog();
  const [activeTab, setActiveTab] = useState("reports");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [coinRequests, setCoinRequests] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userActiveFilter, setUserActiveFilter] = useState("");
  const [reportScope, setReportScope] = useState("all");
  const [postSearch, setPostSearch] = useState("");
  const [postCategoryFilter, setPostCategoryFilter] = useState("");
  const [includeDeletedPosts, setIncludeDeletedPosts] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    category: "announcement",
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
  const pendingCoinRequests = useMemo(
    () => coinRequests.filter((request) => request.status === "pending"),
    [coinRequests]
  );

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [
        overviewResult,
        usersResult,
        projectsResult,
        reportsResult,
        paymentsResult,
        coinRequestsResult,
        adminPostsResult,
        postsResult,
      ] =
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
          getAdminCoinPurchaseRequestsApi(),
          getAdminMyPostsApi(),
          getAdminPostsApi({
            q: postSearch.trim() || undefined,
            category: postCategoryFilter || undefined,
            include_deleted: includeDeletedPosts,
          }),
        ]);

      setOverview(overviewResult.data || null);
      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      setReports(reportsResult.data || []);
      setPayments(paymentsResult.data || []);
      setCoinRequests(coinRequestsResult.data || []);
      setAdminPosts(adminPostsResult.data || []);
      setPosts(postsResult.data || []);
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
  }, [includeDeletedPosts, postCategoryFilter, postSearch, reportScope, userActiveFilter, userSearch, userRoleFilter]);

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

  async function buildReportResolutionPayload(report, status) {
    const payload = { status };
    if (!["resolved", "rejected"].includes(status)) {
      return payload;
    }

    const resolutionType = await prompt({
      title: "신고 처리 종류",
      message: `${report.target_title || `신고 #${report.id}`}에 대한 처분 종류를 입력하세요.`,
      defaultValue: status === "resolved" ? "조치 완료" : "신고 반려",
      placeholder: "예: 강제 내리기, 경고, 신고 반려",
      confirmText: "다음",
      required: true,
    });
    if (resolutionType === null) return null;

    const message = await prompt({
      title: "신고자 안내 메시지",
      message: "신고자에게 알림으로 전달할 간단한 메시지를 입력하세요.",
      defaultValue:
        status === "resolved"
          ? "신고 내용을 확인했고 필요한 조치를 완료했습니다."
          : "신고 내용을 검토했지만 추가 조치 대상은 아니라고 판단했습니다.",
      placeholder: "처리 결과 안내 메시지",
      confirmText: "처리",
      required: true,
      multiline: true,
      tone: status === "rejected" ? "danger" : "default",
    });
    if (message === null) return null;

    return {
      ...payload,
      resolution_type: resolutionType.trim(),
      message: message.trim(),
    };
  }

  async function handleReportStatus(report, status) {
    const payload = await buildReportResolutionPayload(report, status);
    if (!payload) return;

    try {
      setProcessingKey(`report-${report.id}`);
      await updateAdminReportApi(report.id, payload);
      setReports((prev) =>
        prev.map((item) => (item.id === report.id ? { ...item, status } : item))
      );
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              reports_open:
                report.status === "open" && status !== "open"
                  ? Math.max(0, prev.reports_open - 1)
                  : report.status !== "open" && status === "open"
                  ? (prev.reports_open || 0) + 1
                  : prev.reports_open,
            }
          : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "신고 처리에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleTakedownReport(report) {
    if (!report) return;

    const targetPostId = report.target_post_id;
    const targetCommentId = report.target_comment_id;
    const targetProjectId = report.target_project_id;
    // Idea id not present in reports model by default, but support if present
    const targetIdeaId = report.target_idea_id || null;

    if (!targetPostId && !targetCommentId && !targetProjectId && !targetIdeaId) {
      toast.warning("이 신고에 대해 강제 내릴 수 있는 대상이 없습니다.");
      return;
    }

    const ok = await confirm({
      title: "신고 대상 강제 내리기",
      message: "정말로 해당 대상을 강제 삭제(soft delete) 하시겠습니까?",
      confirmText: "강제내리기",
      tone: "danger",
    });
    if (!ok) return;

    const reasonInput = await prompt({
      title: "강제 내리기 사유",
      message: "글 주인에게 전달할 사유를 입력하세요.",
      defaultValue: report.reason || "",
      placeholder: "사유를 입력하세요.",
      confirmText: "전달",
      multiline: true,
    });
    if (reasonInput === null) return;
    const payload = { reason: reasonInput.trim() || undefined };

    try {
      setProcessingKey(`report-takedown-${report.id}`);

      if (targetPostId) {
        await adminTakedownPostApi(targetPostId, payload);
      } else if (targetCommentId) {
        await adminTakedownCommentApi(targetCommentId, payload);
      } else if (targetProjectId) {
        await adminTakedownProjectApi(targetProjectId, payload);
      } else if (targetIdeaId) {
        await adminTakedownIdeaApi(targetIdeaId, payload);
      }
      await updateAdminReportApi(report.id, {
        status: "resolved",
        resolution_type: "강제 내리기",
        message: reasonInput.trim() || "신고 내용을 확인했고 대상 콘텐츠를 강제로 내렸습니다.",
      });

      // mark report resolved locally
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: "resolved" } : r)));
      setOverview((prev) =>
        prev
          ? { ...prev, reports_open: Math.max(0, (prev.reports_open || 0) - 1) }
          : prev
      );

      toast.success("대상이 강제 내리기 처리되었고 작성자에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "강제 내리기에 실패했습니다.");
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
      toast.error(err instanceof Error ? err.message : "결제 이벤트 처리에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleCoinRequest(request, status) {
    const isApprove = status === "approved";
    const isEntitlement = request.request_type === "ENTITLEMENT";
    const requestLabel = isEntitlement
      ? request.product_name || request.product_code || "이용권"
      : `${request.coin_amount}코인`;
    const noteInput = await prompt({
      title: isApprove ? "구매 요청 승인" : "구매 요청 거절",
      message: isApprove
        ? `${request.user_nickname || request.user_email || `User #${request.user_id}`}에게 ${requestLabel}을 지급합니다. 관리자 메모를 입력하세요.`
        : `${request.user_nickname || request.user_email || `User #${request.user_id}`}의 구매 요청을 거절합니다. 사유를 입력하세요.`,
      placeholder: isApprove ? "예: 입금 확인 완료" : "예: 결제 내역을 확인할 수 없습니다.",
      confirmText: isApprove ? "승인" : "거절",
      required: !isApprove,
      multiline: true,
      tone: isApprove ? "default" : "danger",
    });
    if (noteInput === null) return;

    try {
      setProcessingKey(`coin-request-${request.id}`);
      const result = await updateAdminCoinPurchaseRequestApi(request.id, {
        status,
        admin_note: noteInput.trim() || undefined,
      });

      setCoinRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: result.data?.status || status,
                admin_note: result.data?.admin_note || noteInput.trim() || null,
                handled_at: result.data?.handled_at || new Date().toISOString(),
                handled_by: result.data?.handled_by,
              }
            : item
        )
      );

      if (isApprove && result.data?.balance_after !== undefined) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === request.user_id
              ? { ...user, coin_balance: result.data.balance_after }
              : user
          )
        );
      }

      setOverview((prev) =>
        prev
          ? {
              ...prev,
              coin_purchase_requests_pending: Math.max(
                0,
                (prev.coin_purchase_requests_pending || 0) - 1
              ),
            }
          : prev
      );

      toast.success(isApprove ? "코인을 지급하고 사용자에게 알림을 보냈습니다." : "구매 요청을 거절하고 사용자에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코인 구매 요청 처리에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleSuspendUser(user) {
    if (user.deleted_at) {
      toast.warning("탈퇴한 사용자는 정지 상태로 변경할 수 없습니다.");
      return;
    }
    const daysInput = await prompt({
      title: "사용자 정지 기간",
      message: `${user.nickname || user.email || `User #${user.id}`} 사용자를 며칠 동안 정지할까요?\n비워두면 무기한 정지됩니다.`,
      placeholder: "예: 7",
      inputType: "number",
      confirmText: "다음",
    });
    if (daysInput === null) return;

    const trimmedDays = String(daysInput).trim();
    let suspendedUntil = null;
    if (trimmedDays) {
      const days = Number(trimmedDays);
      if (!Number.isFinite(days) || days <= 0) {
        toast.warning("정지 기간은 1 이상의 숫자여야 합니다.");
        return;
      }
      suspendedUntil = addDays(days).toISOString();
    }

    const reasonInput = await prompt({
      title: "사용자 정지 사유",
      message: "사용자에게 알림으로 전달됩니다.",
      placeholder: "정지 사유를 입력하세요.",
      confirmText: "정지",
      required: true,
      multiline: true,
      tone: "danger",
    });
    if (reasonInput === null) return;
    const reason = reasonInput.trim();
    if (!reason) {
      toast.warning("정지 사유를 입력해주세요.");
      return;
    }

    try {
      setProcessingKey(`user-${user.id}`);
      const result = await updateAdminUserStatusApi(user.id, {
        is_active: false,
        suspended_until: suspendedUntil,
        suspension_reason: reason,
      });
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                is_active: result.data?.is_active ?? false,
                suspended_until: result.data?.suspended_until ?? suspendedUntil,
                suspension_reason: result.data?.suspension_reason ?? reason,
              }
            : item
        )
      );
      toast.success("사용자를 정지했고 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "사용자 정지에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleRestoreUser(user) {
    if (user.deleted_at) {
      toast.warning("탈퇴한 사용자는 어드민 정지 복구 대상이 아닙니다.");
      return;
    }
    const ok = await confirm({
      title: "사용자 복구",
      message: `${user.nickname || user.email || `User #${user.id}`} 사용자의 정지를 해제할까요?`,
      confirmText: "복구",
    });
    if (!ok) return;

    try {
      setProcessingKey(`user-${user.id}`);
      const result = await updateAdminUserStatusApi(user.id, { is_active: true });
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                is_active: result.data?.is_active ?? true,
                suspended_until: result.data?.suspended_until ?? null,
                suspension_reason: result.data?.suspension_reason ?? null,
              }
            : item
        )
      );
      toast.success("사용자를 복구했고 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "사용자 복구에 실패했습니다.");
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

    const ok = await confirm({
      title: "사용자 권한 변경",
      message,
      confirmText: "변경",
    });
    if (!ok) return;

    try {
      setProcessingKey(`user-role-${userId}`);
      await updateAdminUserStatusApi(userId, { role });
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role } : user
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "사용자 권한 변경에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleUserPlan(userId, planCode) {
    const targetUser = users.find((user) => user.id === userId);
    const planLabel = USER_PLANS.find((plan) => plan.value === planCode)?.label || planCode;
    const ok = await confirm({
      title: "사용자 플랜 변경",
      message: `${targetUser?.nickname || `User #${userId}`}의 플랜을 ${planLabel}로 변경할까요?`,
      confirmText: "변경",
    });
    if (!ok) return;

    try {
      setProcessingKey(`user-plan-${userId}`);
      const result = await updateAdminUserStatusApi(userId, { plan_code: planCode });
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                current_plan_code: result.data?.current_plan_code ?? planCode,
                current_plan_name: result.data?.current_plan_name ?? planLabel,
                current_plan_type: result.data?.current_plan_type ?? (planCode === "FREE" ? "FREE" : "SUBSCRIPTION"),
                current_plan_expires_at: result.data?.current_plan_expires_at ?? null,
              }
            : user
        )
      );
      toast.success("사용자 플랜을 변경했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "사용자 플랜 변경에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleGrantCoins(userId) {
    const targetUser = users.find((user) => user.id === userId);
    const amountInput = await prompt({
      title: "코인 지급",
      message: `${targetUser?.nickname || `User #${userId}`}에게 지급할 코인 수를 입력하세요.`,
      defaultValue: "100",
      inputType: "number",
      required: true,
    });

    if (amountInput === null) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("코인 수는 1 이상의 숫자여야 합니다.");
      return;
    }

    const noteInput = await prompt({
      title: "코인 지급 사유",
      message: "사용자에게 알림으로 전달됩니다.",
      placeholder: "지급 사유를 입력하세요.",
      required: true,
      multiline: true,
    });
    if (noteInput === null) return;
    const note = noteInput.trim();
    if (!note) {
      toast.warning("코인 지급 사유를 입력해주세요.");
      return;
    }

    try {
      setProcessingKey(`coin-${userId}`);
      const result = await grantAdminUserCoinsApi(userId, {
        amount,
        note,
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, coin_balance: result.data?.coin_balance ?? user.coin_balance }
            : user
        )
      );

      toast.success("코인을 지급했고 사용자에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코인 지급에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleRevokeCoins(userId) {
    const targetUser = users.find((user) => user.id === userId);
    const amountInput = await prompt({
      title: "코인 환수",
      message: `${targetUser?.nickname || `User #${userId}`}으로부터 환수할 코인 수를 입력하세요.`,
      defaultValue: "100",
      inputType: "number",
      required: true,
    });

    if (amountInput === null) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("환수할 코인 수는 1 이상의 숫자여야 합니다.");
      return;
    }

    const noteInput = await prompt({
      title: "코인 환수 사유",
      message: "사용자에게 알림으로 전달됩니다.",
      placeholder: "환수 사유를 입력하세요.",
      required: true,
      multiline: true,
    });
    if (noteInput === null) return;
    const note = noteInput.trim();
    if (!note) {
      toast.warning("코인 환수 사유를 입력해주세요.");
      return;
    }

    try {
      setProcessingKey(`revoke-coin-${userId}`);
      const result = await revokeAdminUserCoinsApi(userId, {
        amount,
        note,
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, coin_balance: result.data?.coin_balance ?? (user.coin_balance - amount) }
            : user
        )
      );

      toast.success("코인을 환수했고 사용자에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코인 환수에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleCreateNotice() {
    if (!noticeForm.title.trim()) {
      toast.warning("공지 제목을 입력해주세요.");
      return;
    }

    if (!noticeForm.content.trim()) {
      toast.warning("공지 내용을 입력해주세요.");
      return;
    }

    try {
      setProcessingKey("notice-create");
      await createAdminNoticeApi({
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        category: noticeForm.category,
        is_pinned: noticeForm.isPinned,
      });

      setNoticeForm({ title: "", content: "", category: "announcement", isPinned: true });
      await loadAdminData();
      toast.success("공지글을 작성했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "공지 작성에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleEditAdminPost(postId) {
    const post = adminPosts.find((p) => p.id === postId);
    if (!post) return;

    const newTitle = await prompt({
      title: "게시물 제목 수정",
      defaultValue: post.title,
      required: true,
    });
    if (newTitle === null) return;
    const newContent = await prompt({
      title: "게시물 내용 수정",
      defaultValue: post.content,
      required: true,
      multiline: true,
    });
    if (newContent === null) return;

    try {
      setProcessingKey(`admin-post-edit-${postId}`);
      await adminUpdatePostApi(postId, { title: newTitle.trim(), content: newContent.trim() });
      setAdminPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, title: newTitle, content: newContent } : p)));
      toast.success("게시물을 수정했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "게시물 수정에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleDeleteAdminPost(postId) {
    const ok = await confirm({
      title: "게시물 삭제",
      message: "정말로 삭제하시겠습니까? (soft delete)",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!ok) return;
    try {
      setProcessingKey(`admin-post-delete-${postId}`);
      await adminDeletePostApi(postId);
      setAdminPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("게시물을 삭제했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "게시물 삭제에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleTakedownPost(postId) {
    const ok = await confirm({
      title: "게시글 강제 내리기",
      message: "정말로 이 게시글을 강제로 내리겠습니까?",
      confirmText: "강제내리기",
      tone: "danger",
    });
    if (!ok) return;
    const reasonInput = await prompt({
      title: "강제 내리기 사유",
      message: "글 주인에게 전달할 사유를 입력하세요.",
      placeholder: "사유를 입력하세요.",
      confirmText: "전달",
      multiline: true,
    });
    if (reasonInput === null) return;

    try {
      setProcessingKey(`post-takedown-${postId}`);
      await adminTakedownPostApi(postId, { reason: reasonInput.trim() || undefined });
      setPosts((prev) =>
        includeDeletedPosts
          ? prev.map((post) =>
              post.id === postId ? { ...post, deleted_at: new Date().toISOString() } : post
            )
          : prev.filter((post) => post.id !== postId)
      );
      toast.success("게시글을 강제로 내렸고 작성자에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "게시글 강제 내리기에 실패했습니다.");
    } finally {
      setProcessingKey("");
    }
  }

  async function handleTakedownProject(projectId) {
    const ok = await confirm({
      title: "프로젝트 강제 내리기",
      message: "정말로 이 프로젝트를 강제로 내리겠습니까?",
      confirmText: "강제내리기",
      tone: "danger",
    });
    if (!ok) return;
    const reasonInput = await prompt({
      title: "강제 내리기 사유",
      message: "리더에게 전달할 사유를 입력하세요.",
      placeholder: "사유를 입력하세요.",
      confirmText: "전달",
      multiline: true,
    });
    if (reasonInput === null) return;

    try {
      setProcessingKey(`project-takedown-${projectId}`);
      await adminTakedownProjectApi(projectId, { reason: reasonInput.trim() || undefined });
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? { ...project, deleted_at: new Date().toISOString() }
            : project
        )
      );
      toast.success("프로젝트를 강제로 내렸고 리더에게 알림을 보냈습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "프로젝트 강제 내리기에 실패했습니다.");
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

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="사용자" value={overview?.users_total} sub={`${overview?.users_active ?? 0} active`} />
          <Metric label="프로젝트" value={overview?.projects_total} sub={`${overview?.projects_active ?? 0} active`} />
          <Metric label="미처리 신고" value={overview?.reports_open} sub={`${overview?.reports_total ?? 0} total`} tone="danger" />
          <Metric label="결제 이벤트" value={overview?.payment_events_total} sub={`${overview?.payment_events_pending ?? 0} pending`} tone="warning" />
          <Metric label="코인 구매" value={overview?.coin_purchase_requests_total} sub={`${overview?.coin_purchase_requests_pending ?? 0} pending`} tone="warning" />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="처리 대기 신고" description={`${openReports.length}건`}>
            <div className="divide-y divide-slate-100">
              {openReports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {report.target_title || `신고 #${report.id}`} · {report.target_scope || "user"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {report.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReportStatus(report, "resolved")}
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

          <Panel title="처리 대기 코인 구매" description={`${pendingCoinRequests.length}건`}>
            <div className="divide-y divide-slate-100">
              {pendingCoinRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {request.user_nickname || request.user_email || `User #${request.user_id}`}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {request.request_type === "ENTITLEMENT"
                        ? request.product_name || request.product_code
                        : `${request.coin_amount?.toLocaleString("ko-KR")}코인`}{" "}
                      · {Number(request.price_krw || 0).toLocaleString("ko-KR")}원
                    </p>
                  </div>
                  <button
                    onClick={() => handleCoinRequest(request, "approved")}
                    disabled={processingKey === `coin-request-${request.id}`}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    승인
                  </button>
                </div>
              ))}
              {pendingCoinRequests.length === 0 && <EmptyLine text="대기 중인 코인 구매 요청이 없습니다." />}
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
                          {report.target_url ? (
                            <a
                              href={report.target_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-slate-900 underline-offset-2 hover:text-red-600 hover:underline"
                            >
                              {report.target_title || "대상 확인"}
                            </a>
                          ) : (
                            <p className="font-semibold text-slate-900">
                              {report.target_title || "-"}
                            </p>
                          )}
                          {report.target_parent_title ? (
                            <p className="text-xs text-slate-400">상위: {report.target_parent_title}</p>
                          ) : null}
                          {report.target_excerpt ? (
                            <p className="mt-1 line-clamp-2 max-w-sm text-xs text-slate-500">
                              {report.target_excerpt}
                            </p>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="max-w-md">
                        <span className="line-clamp-2">{report.reason}</span>
                      </Td>
                      <Td><StatusBadge value={report.status} /></Td>
                      <Td>
                        <select
                          value={report.status}
                          onChange={(e) => handleReportStatus(report, e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {REPORT_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        {(report.target_post_id || report.target_comment_id || report.target_project_id || report.target_idea_id) && (
                          <button
                            onClick={() => handleTakedownReport(report)}
                            disabled={processingKey === `report-takedown-${report.id}`}
                            className="ml-2 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            강제내리기
                          </button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="space-y-8 p-4">
                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-slate-950">수동 구매 요청</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        수동 결제 확인 후 승인하면 물방울 지급 또는 이용권 활성화가 처리됩니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      대기 {pendingCoinRequests.length}건
                    </span>
                  </div>
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <Th>ID</Th>
                        <Th>사용자</Th>
                        <Th>상품</Th>
                        <Th>금액</Th>
                        <Th>상태</Th>
                        <Th>요청 메모</Th>
                        <Th>요청일</Th>
                        <Th>처리</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {coinRequests.map((request) => (
                        <tr key={request.id}>
                          <Td>#{request.id}</Td>
                          <Td>
                            <div className="font-semibold text-slate-900">
                              {request.user_nickname || `User #${request.user_id}`}
                            </div>
                            <div className="text-xs text-slate-500">{request.user_email}</div>
                          </Td>
                          <Td>
                            {request.request_type === "ENTITLEMENT"
                              ? request.product_name || request.product_code
                              : `${request.coin_amount?.toLocaleString("ko-KR")}개`}
                          </Td>
                          <Td>{Number(request.price_krw || 0).toLocaleString("ko-KR")}원</Td>
                          <Td>{COIN_REQUEST_STATUSES[request.status] || request.status}</Td>
                          <Td className="max-w-xs"><span className="line-clamp-2">{request.note || "-"}</span></Td>
                          <Td>{formatDate(request.created_at)}</Td>
                          <Td>
                            {request.status === "pending" ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCoinRequest(request, "approved")}
                                  disabled={processingKey === `coin-request-${request.id}`}
                                  className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => handleCoinRequest(request, "rejected")}
                                  disabled={processingKey === `coin-request-${request.id}`}
                                  className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  거절
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">{formatDate(request.handled_at)}</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h2 className="mb-3 text-base font-black text-slate-950">결제 이벤트 로그</h2>
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
                </section>
              </div>
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
                    <Th>연동</Th>
                    <Th>Role</Th>
                    <Th>Plan</Th>
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
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {user.is_github_linked ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                              GitHub
                            </span>
                          ) : null}
                          {user.is_google_linked ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              Google
                            </span>
                          ) : null}
                          {!user.is_github_linked && !user.is_google_linked ? (
                            <span className="text-xs text-slate-400">일반</span>
                          ) : null}
                        </div>
                        {user.github_id ? (
                          <p className="mt-1 text-xs text-slate-400">github_id: {user.github_id}</p>
                        ) : null}
                      </Td>
                      <Td>{user.role}</Td>
                      <Td>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900">
                            {user.current_plan_name || user.current_plan_code || "무료"}
                          </p>
                          {user.current_plan_type && user.current_plan_type !== "FREE" ? (
                            <p className="text-xs text-slate-500">
                              {user.current_plan_expires_at ? formatDate(user.current_plan_expires_at) : "만료일 없음"}
                            </p>
                          ) : null}
                        </div>
                      </Td>
                      <Td>{user.coin_balance}</Td>
                      <Td>
                        <StatusBadge value={user.deleted_at ? "withdrawn" : user.is_active ? "active" : "suspended"} />
                        {user.deleted_at ? (
                          <div className="mt-1 max-w-56 text-xs leading-5 text-slate-500">
                            <p>탈퇴: {formatDate(user.deleted_at)}</p>
                            <p>탈퇴 계정은 복구할 수 없습니다.</p>
                          </div>
                        ) : !user.is_active ? (
                          <div className="mt-1 max-w-56 text-xs leading-5 text-slate-500">
                            <p>종료: {user.suspended_until ? formatDate(user.suspended_until) : "무기한"}</p>
                            {user.suspension_reason ? (
                              <p className="line-clamp-2">사유: {user.suspension_reason}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                            <select
                              value={user.current_plan_code || "FREE"}
                              onChange={(e) => handleUserPlan(user.id, e.target.value)}
                              disabled={Boolean(user.deleted_at) || processingKey === `user-plan-${user.id}`}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                            {USER_PLANS.map((plan) => (
                              <option key={plan.value} value={plan.value}>
                                {plan.label}
                              </option>
                            ))}
                            </select>
	                          <select
	                            value={user.role}
	                            onChange={(e) => handleUserRole(user.id, e.target.value)}
	                            disabled={Boolean(user.deleted_at) || processingKey === `user-role-${user.id}`}
	                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
	                          >
                            {USER_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
	                          <button
	                            onClick={() => user.is_active ? handleSuspendUser(user) : handleRestoreUser(user)}
	                            disabled={Boolean(user.deleted_at) || processingKey === `user-${user.id}`}
	                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
	                          >
	                            {user.deleted_at ? "탈퇴됨" : user.is_active ? "정지" : "복구"}
	                          </button>
	                          <button
	                            onClick={() => handleGrantCoins(user.id)}
	                            disabled={Boolean(user.deleted_at) || processingKey === `coin-${user.id}`}
	                            className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
	                          >
                            코인 지급
                          </button>
	                          <button
	                            onClick={() => handleRevokeCoins(user.id)}
	                            disabled={Boolean(user.deleted_at) || processingKey === `revoke-coin-${user.id}`}
	                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
	                          >
                            코인 환수
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
                    <div className="flex items-center gap-3">
                      <select
                        value={noticeForm.category}
                        onChange={(e) => setNoticeForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="announcement">공지</option>
                        <option value="event">이벤트</option>
                      </select>
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
                    </div>

                    <textarea
                      value={noticeForm.content}
                      onChange={(e) =>
                        setNoticeForm((prev) => ({ ...prev, content: e.target.value }))
                      }
                      placeholder="공지 내용을 입력하세요."
                      rows={8}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setNoticeForm({
                            title: "",
                            content: "",
                            category: "announcement",
                            isPinned: true,
                          })
                        }
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

            {activeTab === "posts" && (
              <div className="p-4">
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="min-w-64 flex-1">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">검색</label>
                    <input
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      placeholder="제목 또는 내용"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">카테고리</label>
                    <select
                      value={postCategoryFilter}
                      onChange={(e) => setPostCategoryFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">전체</option>
                      <option value="general">자유</option>
                      <option value="question">질문</option>
                      <option value="idea">아이디어</option>
                      <option value="showcase">쇼케이스</option>
                      <option value="event">이벤트</option>
                      <option value="announcement">공지</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeDeletedPosts}
                      onChange={(e) => setIncludeDeletedPosts(e.target.checked)}
                    />
                    삭제 포함
                  </label>
                  <button
                    onClick={loadAdminData}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    검색
                  </button>
                </div>

                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <Th>ID</Th>
                      <Th>게시글</Th>
                      <Th>분류</Th>
                      <Th>작성자</Th>
                      <Th>상태</Th>
                      <Th>생성일</Th>
                      <Th>처리</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <Td>#{post.id}</Td>
                        <Td className="max-w-md">
                          <p className="font-semibold text-slate-900">{post.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{post.content}</p>
                        </Td>
                        <Td>{post.category}</Td>
                        <Td>
                          <p className="font-semibold text-slate-900">
                            {post.author_nickname || `User #${post.author_id}`}
                          </p>
                          <p className="text-xs text-slate-500">User #{post.author_id}</p>
                        </Td>
                        <Td><StatusBadge value={post.deleted_at ? "deleted" : "active"} /></Td>
                        <Td>{formatDate(post.created_at)}</Td>
                        <Td>
                          <button
                            onClick={() => handleTakedownPost(post.id)}
                            disabled={Boolean(post.deleted_at) || processingKey === `post-takedown-${post.id}`}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            강제내리기
                          </button>
                        </Td>
                      </tr>
                    ))}
                    {posts.length === 0 && (
                      <tr>
                        <Td colSpan={7}>
                          <EmptyLine text="조건에 맞는 게시글이 없습니다." />
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                    <Th>처리</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <Td>#{project.id}</Td>
                      <Td className="font-semibold text-slate-900">{project.title}</Td>
                      <Td><StatusBadge value={project.deleted_at ? "deleted" : project.status} /></Td>
                      <Td>
                        <p className="font-semibold text-slate-900">
                          {project.leader_nickname || `User #${project.leader_id}`}
                        </p>
                        <p className="text-xs text-slate-500">User #{project.leader_id}</p>
                      </Td>
                      <Td>{project.category || "-"}</Td>
                      <Td>{formatDate(project.created_at)}</Td>
                      <Td>
                        <button
                          onClick={() => handleTakedownProject(project.id)}
                          disabled={Boolean(project.deleted_at) || processingKey === `project-takedown-${project.id}`}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          강제내리기
                        </button>
                      </Td>
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

function Td({ children, className = "", ...props }) {
  return <td {...props} className={`px-4 py-3 align-top text-slate-700 ${className}`}>{children}</td>;
}

function StatusBadge({ value }) {
  const normalized = String(value || "-");
  const tone =
    ["open", "inactive", "deleted", "suspended", "withdrawn"].includes(normalized)
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
