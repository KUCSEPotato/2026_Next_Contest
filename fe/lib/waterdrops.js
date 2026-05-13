import { getMyCoinBalanceApi } from "./api";

export const WATERDROP_SPEND_AMOUNT = 1;

export async function confirmWaterdropSpend({
  confirmCoinSpend,
  toast,
  actionLabel,
  message,
  tone,
  icon,
}) {
  let balance = 0;

  try {
    const result = await getMyCoinBalanceApi();
    balance = Number(result.data?.waterdrop_balance ?? result.data?.coin_balance ?? 0);
  } catch (error) {
    toast?.error?.(
      error instanceof Error
        ? error.message
        : "물방울 잔액을 불러오지 못했습니다."
    );
    return false;
  }

  const ok = await confirmCoinSpend({
    title: `${actionLabel}에 물방울 1방울을 사용할까요?`,
    message:
      message ||
      "이 물방울은 아이디어 씨앗을 무럭무럭 자라게 해주는 영양이 가득한 물방울입니다.",
    amount: WATERDROP_SPEND_AMOUNT,
    currentBalance: balance,
    unitLabel: "방울",
    confirmText: "물방울 사용하기",
    cancelText: "돌아가기",
    tone,
    icon,
  });

  return Boolean(ok);
}
