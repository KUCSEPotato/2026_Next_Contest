"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useDialog } from "../../../components/AppFeedback";
import { confirmPaymentApi } from "../../../lib/api";

type ConfirmState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string; coinBalance?: number }
  | { status: "error"; message: string };

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { confirm } = useDialog();
  const calledRef = useRef(false);
  const [state, setState] = useState<ConfirmState>({
    status: "loading",
    message: "결제를 승인하는 중입니다.",
  });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = Number(searchParams.get("amount"));

      if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
        setState({ status: "error", message: "결제 승인에 필요한 정보가 부족합니다." });
        return;
      }

      try {
        const result = await confirmPaymentApi({
          paymentKey,
          orderId,
          amount,
        });
        setState({
          status: "success",
          message: `${result.data?.coin_amount?.toLocaleString("ko-KR") || 0}코인이 충전되었습니다.`,
          coinBalance: result.data?.coin_balance,
        });

        // 결제 완료 다이얼로그를 띄우고 사용자가 확인하면 메인으로 이동
        await confirm({
          title: "결제가 완료되었습니다",
          message: "결제가 성공적으로 완료되었습니다.",
          confirmText: "확인",
        });
        router.push("/mainpage");
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
        });
      }
    }

    void confirmPayment();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-red-600">Devory Payments</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          {state.status === "success" ? "결제가 완료되었습니다" : "결제 승인 확인"}
        </h1>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
          {state.message}
          {state.status === "success" && state.coinBalance !== undefined
            ? `\n현재 잔액: ${state.coinBalance.toLocaleString("ko-KR")}코인`
            : ""}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/coins"
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            코인 페이지로
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            홈으로
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
