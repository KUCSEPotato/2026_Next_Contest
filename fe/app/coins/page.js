"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCoinPurchaseRequestApi,
  getCoinPackagesApi,
  getMyCoinBalanceApi,
  getMyCoinPurchaseRequestsApi,
} from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useDialog, useToast } from "../../components/AppFeedback";
import TossPaymentButton from "../../components/payment/TossPaymentButton";

const STATUS_LABELS = {
  pending: "확인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

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

function formatKrw(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatWaterdrops(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ko-KR")}${amount === 1 ? "방울" : "방울"}`;
}

function WaterdropMascot({ className = "h-28 w-28" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      style={{ animation: "floatWaterdrop 3s ease-in-out infinite" }}
    >
      <ellipse cx="60" cy="103" rx="28" ry="7" fill="#bae6fd" opacity="0.55" />
      <path
        d="M60 10C47 29 31 48 31 67c0 19 13 34 29 34s29-15 29-34C89 48 73 29 60 10Z"
        fill="#38bdf8"
      />
      <path
        d="M49 35c-8 10-12 20-12 31 0 14 9 25 22 29-6-11-4-23 3-36 6-11 8-22-1-37-4 5-8 9-12 13Z"
        fill="#7dd3fc"
        opacity="0.9"
      />
      <circle cx="51" cy="65" r="4" fill="#0f172a" />
      <circle cx="71" cy="65" r="4" fill="#0f172a" />
      <path d="M53 78c5 5 12 5 17 0" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="53" r="8" fill="#e0f2fe" opacity="0.75" />
      <path d="M78 27l7-8M86 38l10-3M32 38l-10-4" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
      <style jsx>{`
        @keyframes floatWaterdrop {
          0%,
          100% {
            transform: translateY(0) rotate(-1deg);
          }
          50% {
            transform: translateY(-10px) rotate(2deg);
          }
        }
      `}</style>
    </svg>
  );
}

function PackageIllustration({ amount }) {
  const isSingleDrop = Number(amount || 0) === 1;

  if (isSingleDrop) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50">
        <WaterdropMascot className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50">
      <svg viewBox="0 0 80 80" className="h-14 w-14" aria-hidden="true">
        <ellipse cx="40" cy="68" rx="22" ry="5" fill="#bae6fd" opacity="0.6" />
        <path d="M22 27h36l-5 35H27L22 27Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="4" />
        <path d="M27 42c9 5 17 5 26 0l-3 16H30l-3-16Z" fill="#38bdf8" opacity="0.85" />
        <path d="M58 35h7c5 0 7 4 6 8-1 6-6 9-14 9" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        <path d="M38 10c-5 8-10 14-10 21 0 7 5 12 11 12s11-5 11-12c0-7-6-13-12-21Z" fill="#7dd3fc" />
        <path d="M38 15c-3 5-6 10-6 15 0 4 2 7 6 9-2-7 0-14 4-21l-4-3Z" fill="#e0f2fe" opacity="0.8" />
      </svg>
    </div>
  );
}

export default function CoinsPage() {
  const router = useRouter();
  const toast = useToast();
  const { confirm, prompt } = useDialog();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPackage, setProcessingPackage] = useState("");
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );

  const loadCoins = useCallback(async () => {
    try {
      setLoading(true);
      const [balanceResult, packagesResult, requestsResult] = await Promise.all([
        getMyCoinBalanceApi(),
        getCoinPackagesApi(),
        getMyCoinPurchaseRequestsApi(),
      ]);
      setBalance(balanceResult.data?.waterdrop_balance ?? balanceResult.data?.coin_balance ?? 0);
      setPackages(packagesResult.data || []);
      setRequests(requestsResult.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "물방울 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    queueMicrotask(loadCoins);
  }, [loadCoins, router]);

  async function handleRequestPurchase(packageItem) {
    const ok = await confirm({
      title: "물방울 구매 요청",
      message: `${formatWaterdrops(packageItem.coin_amount)} 구매 요청을 만들까요?\n금액: ${formatKrw(packageItem.price_krw)}\n\n관리자가 결제 확인 후 물방울을 지급합니다.`,
      confirmText: "요청하기",
      cancelText: "돌아가기",
    });
    if (!ok) return;

    const noteInput = await prompt({
      title: "구매 요청 메모",
      message: "입금자명이나 확인에 필요한 메모가 있으면 남겨주세요.",
      placeholder: "예: 입금자명 감자",
      confirmText: "제출",
      cancelText: "건너뛰기",
      multiline: true,
    });
    if (noteInput === null) return;

    try {
      setProcessingPackage(packageItem.id);
      const result = await createCoinPurchaseRequestApi({
        package_id: packageItem.id,
        note: noteInput.trim() || undefined,
      });
      setRequests((prev) => [result.data, ...prev]);
      toast.success("물방울 구매 요청을 보냈습니다. 관리자가 확인 후 지급합니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "물방울 구매 요청에 실패했습니다.");
    } finally {
      setProcessingPackage("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-600">Devory Waterdrops</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-950">물방울 구매</h1>
              <p className="mt-2 text-sm text-slate-600">
                PG 연동 전까지는 구매 요청을 남기면 관리자가 결제 확인 후 물방울을 지급합니다.
              </p>
            </div>
            <div className="flex items-center gap-5">
              <WaterdropMascot />
              <div className="rounded-xl border border-sky-100 bg-sky-50 px-5 py-4 text-right shadow-sm">
              <p className="text-xs font-semibold text-slate-500">현재 잔액</p>
              <p className="text-2xl font-black text-slate-950">
                {formatWaterdrops(balance)}
              </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            물방울 정보를 불러오는 중입니다.
          </div>
        ) : (
          <>
            {pendingRequests.length > 0 ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                확인 대기 중인 구매 요청이 {pendingRequests.length}건 있습니다.
              </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
              {packages.map((packageItem) => (
                <article
                  key={packageItem.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-500">{packageItem.label}</p>
                      <h2 className="mt-2 text-3xl font-black text-slate-950">
                        {formatWaterdrops(packageItem.coin_amount)}
                      </h2>
                    </div>
                    <PackageIllustration amount={packageItem.coin_amount} />
                  </div>
                  <p className="mt-1 text-lg font-bold text-red-600">
                    {formatKrw(packageItem.price_krw)}
                  </p>
                  <TossPaymentButton
                    productId={packageItem.id}
                    label="카드 결제"
                    onError={(err) =>
                      toast.error(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.")
                    }
                    className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => handleRequestPurchase(packageItem)}
                    disabled={processingPackage === packageItem.id}
                    className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {processingPackage === packageItem.id ? "요청 중" : "수동 구매 요청"}
                  </button>
                </article>
              ))}
            </section>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">내 구매 요청</h2>
                <button
                  type="button"
                  onClick={loadCoins}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  새로고침
                </button>
              </div>

              {requests.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  아직 물방울 구매 요청이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">물방울</th>
                        <th className="px-4 py-3">금액</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3">요청일</th>
                        <th className="px-4 py-3">관리자 메모</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.map((request) => (
                        <tr key={request.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">#{request.id}</td>
                          <td className="px-4 py-3">{formatWaterdrops(request.coin_amount)}</td>
                          <td className="px-4 py-3">{formatKrw(request.price_krw)}</td>
                          <td className="px-4 py-3">{STATUS_LABELS[request.status] || request.status}</td>
                          <td className="px-4 py-3">{formatDate(request.created_at)}</td>
                          <td className="px-4 py-3 text-slate-600">{request.admin_note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
