"use client";

export interface MediaItem {
  type: "image" | "video" | "file";
  url: string;
  file: File;
  uploading?: boolean;
  uploadedUrl?: string;
}

export default function MediaPreview({
  media,
  onRemove,
}: {
  media: MediaItem[];
  onRemove: (i: number) => void;
}) {
  if (!media.length) return null;

  const mediaItems = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "image" || item.type === "video");
  const fileItems = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "file");

  return (
    <div className="mt-3 space-y-2">
      {mediaItems.length > 0 && (
        <div
          className={`grid gap-2 ${
            mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {mediaItems.map(({ item: m, index }) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-xl bg-gray-100"
            >
              {m.type === "image" ? (
                <img src={m.url} alt="" className="h-48 w-full object-cover" />
              ) : (
                <video src={m.url} controls className="h-48 w-full object-cover" />
              )}

              {m.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-xs text-white">Uploading...</span>
                </div>
              )}

              <button
                onClick={() => onRemove(index)}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {fileItems.length > 0 && (
        <div className="space-y-2">
          {fileItems.map(({ item: m, index }) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-xl bg-gray-100"
            >
              <div className="flex min-h-16 items-center gap-3 px-4 py-3 pr-12">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-gray-500 shadow-sm">
                  FILE
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

              {m.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-xs text-white">Uploading...</span>
                </div>
              )}

              <button
                onClick={() => onRemove(index)}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
