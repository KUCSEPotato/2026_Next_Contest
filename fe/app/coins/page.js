"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCoinPurchaseRequestApi,
  getCoinPackagesApi,
  getMyCoinBalanceApi,
  getMyCoinPurchaseRequestsApi,
  getMyEntitlementApi,
  getPaymentProductsApi,
} from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useDialog, useToast } from "../../components/AppFeedback";
import TossPaymentButton from "../../components/payment/TossPaymentButton";
import TopActionButtons from "../../components/TopActionButtons";

// ── 상수 ──────────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  pending:  "확인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

const STATUS_COLORS = {
  pending:  "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  rejected: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200",
};

// 백엔드 package id → 일러스트 타입
const PACKAGE_ILLUS_TYPE = {
  drop:   "drop",
  waterdrop: "drop",
  cup:    "glass",
  glass:  "glass",
  bottle: "bottle",
};

const DEFAULT_COIN_PACKAGES = [
  { id: "drop", coin_amount: 1, price_krw: 300, label: "\uD55C \uBC29\uC6B8" },
  { id: "cup", coin_amount: 10, price_krw: 2000, label: "\uD55C \uC794" },
  { id: "bottle", coin_amount: 100, price_krw: 15000, label: "\uD55C \uBCD1" },
];

function normalizeCoinPackages(packages = []) {
  const packageMap = new Map(
    packages
      .filter((pkg) => pkg?.id)
      .map((pkg) => [pkg.id, pkg])
  );

  return DEFAULT_COIN_PACKAGES.map((defaultPackage) => ({
    ...packageMap.get(defaultPackage.id),
    ...defaultPackage,
  }));
}

// ── 포맷 헬퍼 ─────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatKrw(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatWaterdrops(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}방울`;
}

// ── 이용 내역 API (GET /api/v1/coins/transactions/me) ────────────────────────

async function getMyTransactionsApi({ page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  const res = await fetch(`/api/v1/coins/transactions/me?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("이용 내역을 불러오지 못했습니다.");
  return res.json();
}

// ── 히어로 물방울 일러스트 ────────────────────────────────────────────────────

function WaterdropHeroIcon() {
   return (
     <svg
       viewBox="0 0 96 96"
       className="h-24 w-24"
       aria-hidden
       style={{ animation: "floatWaterdrop 3s ease-in-out infinite" }}
     >
       <defs>
         <linearGradient id="wdHeroGrad" x1="20" y1="4" x2="76" y2="92" gradientUnits="userSpaceOnUse">
           <stop offset="0%" stopColor="#bae6fd" />
           <stop offset="55%" stopColor="#38bdf8" />
           <stop offset="100%" stopColor="#0284c7" />
         </linearGradient>
       </defs>
       <ellipse cx="48" cy="90" rx="26" ry="5.5" fill="#bae6fd" opacity="0.4" />
       <path
         d="M48 4C35 21 20 40 20 59c0 20 13 33 28 33s28-13 28-33C76 40 61 21 48 4Z"
         fill="url(#wdHeroGrad)"
       />
       <ellipse cx="36" cy="30" rx="10" ry="16" fill="white" opacity="0.28" transform="rotate(-18 36 30)" />
       <ellipse cx="59" cy="52" rx="3.5" ry="6" fill="white" opacity="0.14" transform="rotate(-10 59 52)" />
       <path
         d="M26 23c-5 10-7 20-7 29 0 11 4 20 13 26"
         stroke="white"
         strokeWidth="4"
         strokeLinecap="round"
         opacity="0.18"
         fill="none"
       />
       <style jsx>{`
         @keyframes floatWaterdrop {
           0%, 100% { transform: translateY(0) scale(1); }
           50% { transform: translateY(-8px) scale(1.03); }
         }
       `}</style>
     </svg>
   );
 }

 function getProjectCreateText(product) {
   if (product?.benefits?.project_create_daily_limit) {
     return `일 ${product.benefits.project_create_daily_limit}회`;
   }
   if (product?.benefits?.project_create_total_limit) {
     return `총 ${product.benefits.project_create_total_limit}회`;
   }
   return "불가";
 }

function getProjectApplyText(product) {
  if (product?.benefits?.project_apply_unlimited) return "무제한";
  if (product?.benefits?.project_apply_daily_limit && product?.benefits?.project_apply_total_limit) {
    return `총 ${product.benefits.project_apply_total_limit}회, 일 ${product.benefits.project_apply_daily_limit}회`;
  }
  if (product?.benefits?.project_apply_total_limit) {
    return `총 ${product.benefits.project_apply_total_limit}회`;
  }
  if (product?.benefits?.project_apply_daily_limit) {
    return `일 ${product.benefits.project_apply_daily_limit}회`;
  }
  return "제한";
}

function getIdeaViewText(product) {
  if (product?.product_code === "PRO_MONTHLY") return "무제한";
  if (product?.benefits?.idea_view_daily_limit) return `일 ${product.benefits.idea_view_daily_limit}회 무료`;
  return "물방울 별도 사용";
}

function getProjectBoostText(product) {
  if (product?.benefits?.project_boost_total_limit) {
    return `기간 내 ${product.benefits.project_boost_total_limit}회`;
  }
  if (product?.product_code === "PLUS_MONTHLY") {
    return "없음";
  }
  return null;
}

function PlanCard({ eyebrow, product, isCurrent, onError, onManualPurchase, manualLoading, children }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
        isCurrent
          ? "border-red-300 ring-2 ring-red-100"
          : "border-slate-200 hover:border-red-200 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-red-600">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{product.name}</h3>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {product.price_krw ? formatKrw(product.price_krw) : "무료"}
          </p>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            현재 사용 중
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">{children}</p>
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        <li>아이디어 열람: {getIdeaViewText(product)}</li>
        <li>프로젝트 생성: {getProjectCreateText(product)}</li>
        <li>프로젝트 버리기: {product.benefits?.project_discard_unlimited ? "무제한" : "불가"}</li>
        <li>프로젝트 지원: {getProjectApplyText(product)}</li>
        {product.benefits?.project_apply_priority && (
          <li>지원자 노출: 지원자 목록 상단 노출</li>
        )}
        {getProjectBoostText(product) ? <li>프로젝트 상단 노출: {getProjectBoostText(product)}</li> : null}
        <li>
          자유게시판:{" "}
          {product.benefits?.community_write_unlimited
            ? "무제한"
            : product.benefits?.community_write_daily_limit
              ? `글쓰기 일 ${product.benefits.community_write_daily_limit}회, 댓글 무제한`
              : "댓글 무제한"}
        </li>
      </ul>
      {isCurrent || product.product_code === "FREE" ? (
        <button
          type="button"
          disabled
          className="mt-5 w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {isCurrent ? "현재 사용 중" : "기본 제공"}
        </button>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <TossPaymentButton
            productId={product.product_code}
            productCode={product.product_code}
            label="카드 결제"
            onError={onError}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
          <button
            type="button"
            onClick={() => onManualPurchase(product)}
            disabled={manualLoading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {manualLoading ? "요청 중" : "수동 구매 요청"}
          </button>
        </div>
      )}
    </article>
  );
}

function WaterdropMascot({ className = "h-28 w-28" }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-24 w-24"
      aria-hidden
      style={{ animation: "floatWaterdrop 3s ease-in-out infinite" }}
    >
      <defs>
        <linearGradient id="wdHeroGrad" x1="20" y1="4" x2="76" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="90" rx="26" ry="5.5" fill="#bae6fd" opacity="0.4" />
      <path
        d="M48 4C35 21 20 40 20 59c0 20 13 33 28 33s28-13 28-33C76 40 61 21 48 4Z"
        fill="url(#wdHeroGrad)"
      />
      <ellipse cx="36" cy="30" rx="10" ry="16" fill="white" opacity="0.28" transform="rotate(-18 36 30)" />
      <ellipse cx="59" cy="52" rx="3.5" ry="6"  fill="white" opacity="0.14" transform="rotate(-10 59 52)" />
      <path d="M26 23c-5 10-7 20-7 29 0 11 4 20 13 26"
        stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.18" fill="none" />
      <style jsx>{`
        @keyframes floatWaterdrop {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-8px) scale(1.03); }
        }
      `}</style>
    </svg>
  );
}

// ── 패키지별 일러스트 ─────────────────────────────────────────────────────────

function PackageIllustration({ type }) {
  if (type === "drop") {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
        <svg viewBox="0 0 60 72" fill="none" className="h-12 w-12" aria-hidden>
          <defs>
            <linearGradient id="pkgDrop" x1="12" y1="4" x2="48" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#bae6fd" /><stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="68" rx="16" ry="3.5" fill="#bae6fd" opacity="0.35" />
          <path d="M30 5C21 16 13 28 13 42c0 15 7.5 23 17 23s17-8 17-23C47 28 39 16 30 5Z" fill="url(#pkgDrop)" />
          <ellipse cx="22" cy="20" rx="7" ry="10" fill="white" opacity="0.28" transform="rotate(-18 22 20)" />
          <path d="M17 16c-3 6-5 13-5 19 0 7 3 13 9 17" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.18" fill="none" />
        </svg>
      </div>
    );
  }

  if (type === "glass") {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
        <svg viewBox="0 0 60 72" fill="none" className="h-12 w-12" aria-hidden>
          <defs>
            <linearGradient id="pkgGlass" x1="10" y1="8" x2="50" y2="62" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#bae6fd" /><stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="69" rx="16" ry="3" fill="#bae6fd" opacity="0.3" />
          <rect x="22" y="62" width="16" height="3.5" rx="1.5" fill="#7dd3fc" />
          <rect x="28" y="46" width="4"  height="17"  rx="2"   fill="#7dd3fc" />
          <path d="M14 10 Q12 30 20 40 Q25 46 30 46 Q35 46 40 40 Q48 30 46 10 Z" fill="url(#pkgGlass)" />
          <path d="M17 28 Q16 36 20 40 Q25 46 30 46 Q35 46 40 40 Q44 36 43 28 Q36 32 24 32 Z" fill="#0284c7" opacity="0.32" />
          <path d="M18 13 Q17 22 19 30" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.32" fill="none" />
        </svg>
      </div>
    );
  }

  // bottle
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
      <svg viewBox="0 0 60 72" fill="none" className="h-12 w-12" aria-hidden>
        <defs>
          <linearGradient id="pkgBottle" x1="10" y1="8" x2="50" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#93c5fd" /><stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
        <ellipse cx="30" cy="68" rx="18" ry="3.5" fill="#bae6fd" opacity="0.3" />
        <rect x="23" y="5"  width="14" height="8" rx="3.5" fill="#0369a1" />
        <rect x="21" y="12" width="18" height="6" rx="3"   fill="#93c5fd" />
        <path d="M13 18 Q11 23 11 29 L11 56 Q11 66 30 66 Q49 66 49 56 L49 29 Q49 23 47 18 Z" fill="url(#pkgBottle)" />
        <path d="M11 40 L11 56 Q11 66 30 66 Q49 66 49 56 L49 40 Q38 45 22 45 Z" fill="#0369a1" opacity="0.28" />
        <rect x="11" y="36" width="38" height="8" fill="#38bdf8" opacity="0.3" />
        <path d="M17 21 Q16 31 16 43" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.26" fill="none" />
      </svg>
    </div>
  );
}

// ── 이용 내역 팝업 ────────────────────────────────────────────────────────────

function HistoryModal({ onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyTransactionsApi()
      .then((res) => setTransactions(res.data?.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-50">이용 내역</h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">불러오는 중…</p>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">이용 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">일시</th>
                  <th className="px-3 py-2">구분</th>
                  <th className="px-3 py-2">변동</th>
                  <th className="px-3 py-2">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {transactions.map((t) => (
                  <tr key={t.id} className="transition hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-slate-400">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-slate-300">
                      {t.note || t.event_type || (t.direction === "earned" ? "충전" : "사용")}
                    </td>
                    <td className={`px-3 py-2.5 font-semibold ${
                      t.amount > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500 dark:text-rose-400"
                    }`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}방울
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-slate-300">
                      {t.balance_after}방울
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function CoinsPage() {
  const router = useRouter();
  const toast  = useToast();
  const { confirm, prompt } = useDialog();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState([]);
  const [paymentProducts, setPaymentProducts] = useState([]);
  const [entitlement, setEntitlement] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPackage, setProcessingPackage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests],
  );
  const freeProduct = useMemo(
    () =>
      paymentProducts.find((product) => product.product_code === "FREE") || {
        product_code: "FREE",
        product_type: "FREE",
        name: "무료",
        price_krw: 0,
        duration_days: null,
        benefits: {
          project_apply_daily_limit: 1,
          community_write_daily_limit: 1,
        },
      },
    [paymentProducts],
  );
  const subscriptionProducts = useMemo(
    () => paymentProducts.filter((product) => product.product_type === "SUBSCRIPTION"),
    [paymentProducts],
  );
  const passProducts = useMemo(
    () => paymentProducts.filter((product) => product.product_type === "PASS"),
    [paymentProducts],
  );
  const currentPlanCode = entitlement?.plan || entitlement?.product_code || "FREE";

  const loadCoins = useCallback(async () => {
    try {
      setLoading(true);
      const [balanceResult, packagesResult, requestsResult, productsResult, entitlementResult] = await Promise.all([
        getMyCoinBalanceApi(),
        getCoinPackagesApi(),
        getMyCoinPurchaseRequestsApi(),
        getPaymentProductsApi(),
        getMyEntitlementApi(),
      ]);
      setBalance(balanceResult.data?.waterdrop_balance ?? balanceResult.data?.coin_balance ?? 0);
      setPackages(normalizeCoinPackages(packagesResult.data || []));
      setRequests(requestsResult.data || []);
      setPaymentProducts(productsResult.data || []);
      setEntitlement(entitlementResult.data || null);
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

  const handlePaymentError = useCallback((err) => {
    toast.error(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.");
  }, [toast]);

  async function handleRequestProductPurchase(product) {
    const ok = await confirm({
      title: "이용권 구매 요청",
      message: `${product.name} 구매 요청을 만들까요?\n금액: ${formatKrw(product.price_krw)}\n\n관리자가 결제 확인 후 이용권을 활성화합니다.`,
      confirmText: "요청하기",
      cancelText: "돌아가기",
    });
    if (!ok) return;

    const noteInput = await prompt({
      title: "구매 요청 메모",
      message: "입금자명이나 확인에 필요한 메모가 있으면 남겨주세요.",
      placeholder: "예: 입금자명 홍길동",
      confirmText: "제출",
      cancelText: "건너뛰기",
      multiline: true,
    });
    if (noteInput === null) return;

    try {
      setProcessingPackage(product.product_code);
      const result = await createCoinPurchaseRequestApi({
        product_code: product.product_code,
        note: noteInput.trim() || undefined,
      });
      setRequests((prev) => [result.data, ...prev]);
      toast.success("이용권 구매 요청을 보냈습니다. 관리자가 확인 후 활성화합니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이용권 구매 요청에 실패했습니다.");
    } finally {
      setProcessingPackage("");
    }
  }

  async function handleRequestPurchase(pkg) {
    const ok = await confirm({
      title: "물방울 구매 요청",
      message: `${formatWaterdrops(pkg.coin_amount)} 구매 요청을 만들까요?\n금액: ${formatKrw(pkg.price_krw)}\n\n관리자가 결제 확인 후 물방울을 지급합니다.`,
      confirmText: "요청하기",
      cancelText:  "돌아가기",
    });
    if (!ok) return;

    const noteInput = await prompt({
      title:       "구매 요청 메모",
      message:     "입금자명이나 확인에 필요한 메모가 있으면 남겨주세요.",
      placeholder: "예: 입금자명 감자",
      confirmText: "제출",
      cancelText:  "건너뛰기",
      multiline:   true,
    });
    if (noteInput === null) return;

    try {
      setProcessingPackage(pkg.id);
      const result = await createCoinPurchaseRequestApi({
        package_id: pkg.id,
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
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <TopActionButtons />

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ── 히어로 ── */}
        <section className="pb-10 pt-6 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <WaterdropHeroIcon />
          </div>

          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-slate-50 sm:text-4xl">
            물방울 상점
          </h1>

          <p className="mx-auto mb-6 max-w-md text-sm leading-7 text-gray-500 dark:text-slate-400 sm:text-base">
            아이디어 씨앗을 무럭무럭 자라게 해줄<br />
            영양 가득한 물이에요.
          </p>

          {/* 잔액 + 이용 내역 버튼 */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
                <defs>
                  <linearGradient id="balGrad" x1="4" y1="2" x2="16" y2="18" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#bae6fd" /><stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <path d="M10 2C7.5 5.5 5 9 5 12c0 3 1.8 5 5 5s5-2 5-5c0-3-2.5-6.5-5-10Z" fill="url(#balGrad)" />
                <ellipse cx="7.8" cy="8" rx="2" ry="3.2" fill="white" opacity="0.35" transform="rotate(-18 7.8 8)" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] font-semibold text-sky-500 dark:text-sky-300">현재 잔액</p>
                <p className="text-lg font-bold text-gray-900 dark:text-slate-50">
                  {formatWaterdrops(balance)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-sky-500/40 dark:hover:text-sky-300"
            >
              이용 내역 조회
            </button>
          </div>
        </section>

        {/* ── 컨텐츠 ── */}
        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
            물방울 정보를 불러오는 중입니다.
          </div>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                확인 대기 중인 구매 요청이 {pendingRequests.length}건 있습니다.
              </div>
            )}

            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">무료 요금제</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  결제 없이 기본으로 제공되는 사용 범위입니다.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <PlanCard
                  eyebrow="기본 제공"
                  product={freeProduct}
                  isCurrent={currentPlanCode === "FREE"}
                  onError={handlePaymentError}
                  onManualPurchase={handleRequestProductPurchase}
                  manualLoading={false}
                >
                  물방울을 별도 사용하면서 가볍게 둘러볼 수 있습니다.
                </PlanCard>
              </div>
            </section>

            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">월정액 요금제</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Plus와 Pro는 현재 30일 이용권 형태로 제공됩니다.
                  {entitlement?.product_type === "SUBSCRIPTION" && entitlement.next_renewal_at
                    ? ` 다음 갱신 기준일은 ${formatShortDate(entitlement.next_renewal_at)}입니다.`
                    : ""}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {subscriptionProducts.map((product) => (
                  <PlanCard
                    key={product.product_code}
                    eyebrow="월정액 30일권"
                    product={product}
                    isCurrent={currentPlanCode === product.product_code}
                    onError={handlePaymentError}
                    onManualPurchase={handleRequestProductPurchase}
                    manualLoading={processingPackage === product.product_code}
                  >
                    {product.duration_days}일 동안 월정액 권한이 유지됩니다.
                  </PlanCard>
                ))}
                {subscriptionProducts.length === 0 && (
                  <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-500">
                    월정액 상품을 불러오지 못했습니다.
                  </p>
                )}
              </div>
            </section>

            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">정액제 기간권</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  짧은 기간 동안 프로젝트 생성/지원 권한을 쓰는 패스입니다. 기간권은 자동 갱신되지 않습니다.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {passProducts.map((product) => (
                  <PlanCard
                    key={product.product_code}
                    eyebrow={`${product.duration_days}일 기간권`}
                    product={product}
                    isCurrent={currentPlanCode === product.product_code}
                    onError={handlePaymentError}
                    onManualPurchase={handleRequestProductPurchase}
                    manualLoading={processingPackage === product.product_code}
                  >
                    결제일부터 {product.duration_days}일 동안 활성화됩니다.
                  </PlanCard>
                ))}
                {passProducts.length === 0 && (
                  <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-500">
                    기간권 상품을 불러오지 못했습니다.
                  </p>
                )}
              </div>
            </section>

            <section className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">물방울 충전</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  FREE/PASS 사용자의 아이디어 열람 등에 사용할 물방울입니다.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {packages.map((pkg) => (
                  <article
                    key={pkg.id}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-sky-500/30"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sky-500 dark:text-sky-400">
                          {pkg.label}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-50">
                          {formatWaterdrops(pkg.coin_amount)}
                        </h2>
                        <p className="mt-0.5 text-sm font-bold text-red-500 dark:text-red-400">
                          {formatKrw(pkg.price_krw)}
                        </p>
                      </div>
                      <PackageIllustration type={PACKAGE_ILLUS_TYPE[pkg.id] ?? "drop"} />
                    </div>

                  <TossPaymentButton
                    productId={pkg.id}
                    label="카드 결제"
                    onError={(err) =>
                      toast.error(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.")
                    }
                    className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRequestPurchase(pkg)}
                    disabled={processingPackage === pkg.id}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    {processingPackage === pkg.id ? "요청 중…" : "수동 구매 요청"}
                  </button>
                </article>
              ))}
              </div>
            </section>

            {/* 구매 요청 내역 */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-50">내 구매 요청</h2>
                <button
                  type="button"
                  onClick={loadCoins}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  새로고침
                </button>
              </div>

              {requests.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-400 dark:bg-slate-800 dark:text-slate-500">
                  아직 물방울 구매 요청이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">상품</th>
                        <th className="px-4 py-3">금액</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3">요청일</th>
                        <th className="px-4 py-3">관리자 메모</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                      {requests.map((request) => (
                        <tr key={request.id} className="transition hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">
                            #{request.id}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                            {request.request_type === "ENTITLEMENT"
                              ? request.product_name || request.product_code
                              : formatWaterdrops(request.coin_amount)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                            {formatKrw(request.price_krw)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[request.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {STATUS_LABELS[request.status] ?? request.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                            {request.admin_note || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}
