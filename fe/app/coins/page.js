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
      setBalance(balanceResult.data?.coin_balance || 0);
      setPackages(packagesResult.data || []);
      setRequests(requestsResult.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코인 정보를 불러오지 못했습니다.");
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
      title: "코인 구매 요청",
      message: `${packageItem.coin_amount.toLocaleString("ko-KR")}코인 구매 요청을 만들까요?\n금액: ${formatKrw(packageItem.price_krw)}\n\n관리자가 결제 확인 후 코인을 지급합니다.`,
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
      toast.success("코인 구매 요청을 보냈습니다. 관리자가 확인 후 지급합니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "코인 구매 요청에 실패했습니다.");
    } finally {
      setProcessingPackage("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-600">Devory Coins</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-950">코인 구매</h1>
              <p className="mt-2 text-sm text-slate-600">
                PG 연동 전까지는 구매 요청을 남기면 관리자가 결제 확인 후 코인을 지급합니다.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
              <p className="text-xs font-semibold text-slate-500">현재 잔액</p>
              <p className="text-2xl font-black text-slate-950">
                {balance.toLocaleString("ko-KR")} 코인
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            코인 정보를 불러오는 중입니다.
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
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-500">{packageItem.label}</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950">
                    {packageItem.coin_amount.toLocaleString("ko-KR")} 코인
                  </h2>
                  <p className="mt-1 text-lg font-bold text-red-600">
                    {formatKrw(packageItem.price_krw)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRequestPurchase(packageItem)}
                    disabled={processingPackage === packageItem.id}
                    className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {processingPackage === packageItem.id ? "요청 중" : "구매 요청"}
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
                  아직 코인 구매 요청이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">코인</th>
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
                          <td className="px-4 py-3">{request.coin_amount?.toLocaleString("ko-KR")}개</td>
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
