"use client";

import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { useState } from "react";
import { preparePaymentApi } from "../../lib/api";
import { getStoredUser } from "../../lib/auth";

type TossPaymentButtonProps = {
  productId: string;
  productCode?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  onError?: (error: unknown) => void;
};

function getRedirectUrl(envValue: string | undefined, pathname: string) {
  if (envValue) return envValue;
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}`;
}

function buildCustomerKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `devory_${crypto.randomUUID()}`;
  }
  return `devory_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function TossPaymentButton({
  productId,
  productCode,
  label = "카드 결제",
  className = "",
  disabled = false,
  onError,
}: TossPaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      onError?.(new Error("토스페이먼츠 Client Key가 설정되지 않았습니다."));
      return;
    }

    try {
      setLoading(true);
      const result = await preparePaymentApi({ product_code: productCode || productId });
      const paymentOrder = result.data;
      const user = getStoredUser();
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: buildCustomerKey() });

      await payment.requestPayment({
        method: "CARD",
        amount: {
          currency: "KRW",
          value: Number(paymentOrder.amount),
        },
        orderId: paymentOrder.order_id,
        orderName: paymentOrder.order_name,
        successUrl:
          paymentOrder.success_url ||
          getRedirectUrl(process.env.NEXT_PUBLIC_TOSS_SUCCESS_URL, "/payment/success"),
        failUrl:
          paymentOrder.fail_url ||
          getRedirectUrl(process.env.NEXT_PUBLIC_TOSS_FAIL_URL, "/payment/fail"),
        customerEmail: user?.email,
        customerName: user?.nickname || user?.name,
        card: {
          flowMode: "DEFAULT",
          useEscrow: false,
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (error) {
      onError?.(error);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={disabled || loading}
      className={className}
    >
      {loading ? "결제 준비 중" : label}
    </button>
  );
}
