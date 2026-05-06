"use client";

import { useEffect, useState } from "react";
import { getNotificationsApi, readNotificationApi } from "../../lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const result = await getNotificationsApi();
        setNotifications(result.data || []);
      } catch (error) {
        console.error(error);
        setNotifications([]);
      }
    }

    loadNotifications();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900">알림</h1>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {notifications.length === 0 ? (
            <p className="text-slate-500">아직 알림이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={async () => {
                    await readNotificationApi(notification.id);
                    setNotifications((prev) =>
                      prev.map((item) =>
                        item.id === notification.id
                          ? { ...item, is_read: true }
                          : item
                      )
                    );
                  }}
                  className={`w-full rounded-xl border px-5 py-4 text-left transition ${
                    notification.is_read
                      ? "border-slate-200 bg-slate-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-1 text-sm text-slate-600">
                      {notification.body}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}