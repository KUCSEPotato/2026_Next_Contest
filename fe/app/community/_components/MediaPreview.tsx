"use client";

export interface MediaItem {
  type: "image" | "video" | "file";
  url: string;       // 로컬 object URL (미리보기용)
  file: File;        // 실제 파일 (업로드 시 사용)
  uploading?: boolean;
  uploadedUrl?: string; // TODO: 업로드 완료 후 BE에서 받은 URL
}

export default function MediaPreview({
  media,
  onRemove,
}: {
  media: MediaItem[];
  onRemove: (i: number) => void;
}) {
  if (!media.length) return null;

  return (
    <div
      className={`mt-3 grid gap-2 ${
        media.length === 1 ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {media.map((m, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl bg-gray-100"
        >
          {m.type === "image" ? (
            <img src={m.url} alt="" className="h-48 w-full object-cover" />
          ) : m.type === "video" ? (
            <video src={m.url} controls className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-28 items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                📄
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {m.file.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {(m.file.size / 1024 / 1024).toFixed(2)}MB
                </p>
              </div>
            </div>
          )}

          {/* 업로드 중 오버레이 */}
          {m.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-xs text-white">업로드 중...</span>
            </div>
          )}

          {/* 삭제 버튼 */}
          <button
            onClick={() => onRemove(i)}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
