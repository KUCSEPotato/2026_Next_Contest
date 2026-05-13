"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { recordPaymentFailureApi } from "../../../lib/api";

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const calledRef = useRef(false);
  const orderId = searchParams.get("orderId");
  const code = searchParams.get("code");
  const message = searchParams.get("message") || "결제가 완료되지 않았습니다.";

  useEffect(() => {
    if (calledRef.current || !orderId) return;
    calledRef.current = true;

    void recordPaymentFailureApi({
      orderId,
      code: code || undefined,
      message,
    }).catch(() => {
      // 화면은 결제 실패 안내를 유지하고, 기록 실패만 조용히 무시합니다.
    });
  }, [code, message, orderId]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-red-600">Devory Payments</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">결제가 실패했습니다</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>
        {code ? <p className="mt-2 text-xs font-semibold text-slate-400">오류 코드: {code}</p> : null}
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/coins"
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            다시 시도
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

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <PaymentFailContent />
    </Suspense>
  );
}
