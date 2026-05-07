"use client";

export default function LoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="mb-2 text-base font-bold text-gray-900">
          로그인이 필요한 서비스예요
        </h2>
        <p className="mb-6 text-sm text-gray-400">
          게시물 작성 및 댓글은
          <br />
          로그인 후 이용할 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onLogin}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            로그인하기
          </button>
        </div>
      </div>
    </div>
  );
}