"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNotificationsApi, readNotificationApi } from "../../lib/api";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await getNotificationsApi();
      setNotifications(result.data || []);
    } catch (error) {
      console.error(error);
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadNotifications();
    });
  }, [loadNotifications]);

  function formatDate(value) {
    if (!value) return "일시 없음";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "일시 없음";
    }

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getNotificationPath(notification) {
    if (notification.type === "admin_takedown") {
      return null;
    }

    if (notification.url) return notification.url;
    if (notification.data?.url) return notification.data.url;
    if (notification.link_url) return notification.link_url;
    if (notification.project_id) return `/projects/${notification.project_id}`;
    if (notification.data?.project_id) return `/projects/${notification.data.project_id}`;
    if (notification.post_id) return `/community/${notification.post_id}`;
    if (notification.data?.post_id) return `/community/${notification.data.post_id}`;

    const type = notification.type || notification.notification_type;

    if (
      type === "project_formed" ||
      type === "project_created" ||
      type === "project_application" ||
      type === "application_accepted"
    ) {
      const projectId =
        notification.project_id ||
        notification.target_id ||
        notification.data?.project_id;

      if (projectId) return `/projects/${projectId}`;
    }

    if (type === "idea_adopted") {
      const ideaId = notification.idea_id || notification.target_id;
      if (ideaId) return `/ideas/${ideaId}`;
    }

    if (type === "comment_created" || type === "hot_post") {
      const postId =
        notification.post_id ||
        notification.target_id ||
        notification.data?.post_id;

      if (postId) return `/community/${postId}`;
    }

    if (type === "review_created") {
      return "/mypage";
    }

    return null;
  }

  function getTakedownTargetLabel(targetType) {
    if (targetType === "project") return "프로젝트";
    if (targetType === "idea") return "아이디어";
    if (targetType === "community_post") return "게시글";
    return "대상";
  }

  function getNotificationTitle(notification) {
    if (notification.type !== "admin_takedown") {
      return notification.title;
    }

    const targetTitle = notification.data?.target_title;
    const targetLabel = getTakedownTargetLabel(notification.data?.target_type);

    if (!targetTitle) {
      return notification.title || `${targetLabel}이 내려졌습니다`;
    }

    return `${targetLabel} '${targetTitle}'이 내려졌습니다`;
  }

  function getNotificationBody(notification) {
    if (notification.type !== "admin_takedown") {
      return notification.body;
    }

    const targetTitle = notification.data?.target_title;
    const targetLabel = getTakedownTargetLabel(notification.data?.target_type);
    const reason = notification.data?.reason;
    const body =
      notification.body ||
      (targetTitle
        ? `작성하신 ${targetLabel} '${targetTitle}'이 관리자에 의해 내려졌습니다.`
        : `작성하신 ${targetLabel}이 관리자에 의해 내려졌습니다.`);

    if (reason && !body.includes("사유:")) {
      return `${body}\n사유: ${reason}`;
    }

    return body;
  }

  async function markAsRead(notificationId) {
    try {
      setProcessingId(notificationId);

      await readNotificationApi(notificationId);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );
    } catch (error) {
      console.error(error);
      alert("읽음 처리에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleNotificationClick(notification) {
    const path = getNotificationPath(notification);

    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (path) {
      router.push(path);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900">알림</h1>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {notifications.length === 0 ? (
            <p className="text-slate-500">아직 알림이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const path = getNotificationPath(notification);
                const title = getNotificationTitle(notification);
                const body = getNotificationBody(notification);

                return (
                  <div
                    key={notification.id}
                    className={`rounded-xl border px-5 py-4 transition ${
                      notification.is_read
                        ? "border-slate-200 bg-slate-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {title}
                          </p>

                          {body && (
                            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                              {body}
                            </p>
                          )}

                          {notification.type === "admin_takedown" &&
                            notification.data?.target_title && (
                              <div className="mt-3 inline-flex rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700">
                                내려진 항목: {getTakedownTargetLabel(notification.data?.target_type)} ·{" "}
                                {notification.data.target_title}
                              </div>
                            )}

                          <p className="mt-2 text-xs text-slate-400">
                            {formatDate(
                              notification.created_at ||
                                notification.createdAt ||
                                notification.sent_at
                            )}
                          </p>
                        </div>

                        {!notification.is_read && (
                          <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                            새 알림
                          </span>
                        )}
                      </div>

                      {path && (
                        <p className="mt-3 text-xs font-semibold text-red-600">
                          클릭하면 관련 페이지로 이동합니다.
                        </p>
                      )}
                    </button>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        disabled={notification.is_read || processingId === notification.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {notification.is_read ? "읽음" : "읽음 처리"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
