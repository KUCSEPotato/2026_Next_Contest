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
            <div className="flex h-28 flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="text-2xl">📎</span>
              <span className="max-w-full truncate text-xs font-medium text-gray-700">
                {m.file.name}
              </span>
              <span className="text-[11px] text-gray-400">
                {(m.file.size / 1024 / 1024).toFixed(1)}MB
              </span>
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
