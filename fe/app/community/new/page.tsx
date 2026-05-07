"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "../_types";
import { createPost } from "../_lib/api";
import MediaPreview, { MediaItem } from "../_components/MediaPreview";

const CATEGORIES = ["IT/소프트웨어", "경영/경제", "디자인", "AI/데이터", "기타"];

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 50;

// TODO: BE 미디어 업로드 API 구현 후 아래 함수 채우기
// async function uploadMediaFile(file: File): Promise<string> {
//   const formData = new FormData();
//   formData.append("file", file);
//   const res = await fetch(
//     `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/community/media/upload`,
//     {
//       method: "POST",
//       headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
//       body: formData,
//     }
//   );
//   const json = await res.json();
//   return json.data.url;
// }

export default function NewPostPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    const raw = localStorage.getItem("user");
    if (raw) setCurrentUser(JSON.parse(raw));
  }, [router]);

  // ── 파일 선택 ──────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    const overSize = files.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (overSize.length) {
      setError(`파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하만 가능해요.`);
      return;
    }

    if (media.length + files.length > MAX_FILES) {
      setError(`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    setError("");
    const newItems: MediaItem[] = files.map((file) => ({
      type,
      url: URL.createObjectURL(file),
      file,
    }));
    setMedia((prev) => [...prev, ...newItems]);
  };

  const handleRemoveMedia = (i: number) => {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[i].url); // 메모리 해제
      return prev.filter((_, idx) => idx !== i);
    });
  };

  // ── 제출 ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!content.trim()) { setError("내용을 입력해주세요."); return; }
    setSubmitting(true);
    setError("");

    try {
      // TODO: BE 미디어 업로드 API 완성 후 아래 주석 해제
      // const mediaUrls: string[] = [];
      // for (let i = 0; i < media.length; i++) {
      //   setMedia((prev) =>
      //     prev.map((m, idx) => idx === i ? { ...m, uploading: true } : m)
      //   );
      //   const url = await uploadMediaFile(media[i].file);
      //   mediaUrls.push(url);
      //   setMedia((prev) =>
      //     prev.map((m, idx) => idx === i ? { ...m, uploading: false, uploadedUrl: url } : m)
      //   );
      // }

      const post = await createPost({
        title: title.trim() || undefined as any,
        content: content.trim(),
        category: category || undefined,
        // TODO: mediaUrls 추가
        // media_urls: mediaUrls,
      });

      router.push(`/community/${post.id}`);
    } catch (e: any) {
      setError(e.message ?? "게시물 작성에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
          >
            ← 뒤로
          </button>
          <h1 className="text-base font-bold text-gray-900">새 게시물</h1>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="rounded-xl bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
          >
            {submitting ? "게시 중..." : "게시하기"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-500">
            {error}
          </div>
        )}

        {/* 글 작성 영역 */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (선택사항)"
            className="mb-3 w-full border-b border-gray-100 pb-3 text-base font-semibold text-gray-900 placeholder-gray-300 outline-none"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="무슨 생각을 하고 계신가요?"
            rows={10}
            className="w-full resize-none text-sm leading-relaxed text-gray-800 placeholder-gray-300 outline-none"
          />

          {/* 미디어 미리보기 */}
          <MediaPreview media={media} onRemove={handleRemoveMedia} />
        </div>

        {/* 카테고리 */}
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">카테고리</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? "" : cat)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  category === cat
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 파일 첨부 툴바 */}
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              파일 첨부
              <span className="ml-1.5 text-gray-300">
                ({media.length}/{MAX_FILES}) · 최대 {MAX_FILE_SIZE_MB}MB
              </span>
            </p>

            {/* 업로드 비활성 안내 — BE 완성 후 제거 */}
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-500">
              ⚠️ 저장은 API 연동 후 적용
            </span>
          </div>

          <div className="mt-2 flex gap-2">
            {/* 사진 */}
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "image")}
            />
            <button
              onClick={() => imageRef.current?.click()}
              disabled={media.length >= MAX_FILES}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              📷 사진
            </button>

            {/* 동영상 */}
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "video")}
            />
            <button
              onClick={() => videoRef.current?.click()}
              disabled={media.length >= MAX_FILES}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              🎥 동영상
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
