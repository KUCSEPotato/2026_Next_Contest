"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { confirmPaymentApi } from "../../../lib/api";

type ConfirmState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string; coinBalance?: number; productCode?: string }
  | { status: "error"; message: string };

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
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
        const data = result.data || {};
        const isEntitlementPayment = Boolean(data.product_code);

        setState({
          status: "success",
          message: isEntitlementPayment
            ? `${data.order_name || "이용권"} 권한이 활성화되었습니다.`
            : `${data.coin_amount?.toLocaleString("ko-KR") || 0}코인이 충전되었습니다.`,
          coinBalance: data.coin_balance,
          productCode: data.product_code,
        });

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
          {state.status === "success" && state.productCode
            ? `\n상품 코드: ${state.productCode}`
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
            href="/mainpage"
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

