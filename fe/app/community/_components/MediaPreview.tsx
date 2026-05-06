"use client";

export interface MediaItem {
  type: "image" | "video";
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
          ) : (
            <video src={m.url} controls className="h-48 w-full object-cover" />
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
