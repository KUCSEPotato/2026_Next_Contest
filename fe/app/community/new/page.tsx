"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "../_types";
import { createPost, uploadPostFile } from "../_lib/api";
import MediaPreview, { MediaItem } from "../_components/MediaPreview";

const CATEGORIES = [
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
  { label: "이벤트", value: "event" },
];

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 50;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

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
    Promise.resolve().then(() => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const raw = localStorage.getItem("user");
        if (raw) setCurrentUser(JSON.parse(raw) as User);
      } catch (e) {
        console.error("유저 정보 파싱 실패", e);
        localStorage.removeItem("user");
      }
    });
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
      const post = await createPost({
        title: title.trim() || content.trim().slice(0, 50),
        content: content.trim(),
        category: category || undefined,
      });

      let failedUploadCount = 0;
      for (let i = 0; i < media.length; i += 1) {
        setMedia((prev) =>
          prev.map((m, idx) => idx === i ? { ...m, uploading: true } : m)
        );

        try {
          const uploaded = await uploadPostFile(post.id, media[i].file);
          setMedia((prev) =>
            prev.map((m, idx) =>
              idx === i ? { ...m, uploading: false, uploadedUrl: uploaded.s3_url } : m
            )
          );
        } catch (uploadError) {
          failedUploadCount += 1;
          console.error("파일 업로드 실패", uploadError);
          setMedia((prev) =>
            prev.map((m, idx) => idx === i ? { ...m, uploading: false } : m)
          );
        }
      }

      if (failedUploadCount > 0) {
        alert(`게시물은 작성됐지만 파일 ${failedUploadCount}개 업로드에 실패했어요.`);
      }

      router.push(`/community/${post.id}`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "게시물 작성에 실패했어요."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="w-[68px]" aria-hidden="true" />
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
            className="mb-3 w-full border-b border-gray-100 bg-white pb-3 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="무슨 생각을 하고 계신가요?"
            rows={10}
            className="w-full resize-none bg-white text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
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
                key={cat.value}
                onClick={() => setCategory(category === cat.value ? "" : cat.value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  category === cat.value
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500"
                }`}
              >
                {cat.label}
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
              disabled={submitting || media.length >= MAX_FILES}
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
              disabled={submitting || media.length >= MAX_FILES}
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
