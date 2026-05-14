"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "../_types";
import { createPost, uploadPostFile } from "../_lib/api";
import MediaPreview, { MediaItem } from "../_components/MediaPreview";

const CATEGORIES = [
  { label: "?쇰컲", value: "general" },
  { label: "吏덈Ц", value: "question" },
  { label: "?꾩씠?붿뼱", value: "idea" },
  { label: "?묒뾽 怨듭쑀", value: "showcase" },
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
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video" | "file"
  ) => {
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
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

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
        console.error("?좎? ?뺣낫 ?뚯떛 ?ㅽ뙣", e);
        localStorage.removeItem("user");
      }
    });
  }, [router]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const post = await createPost({
        title: title.trim(),
        content: content.trim(),
        category: category || undefined,
      });

      let failedUploadCount = 0;
      for (let i = 0; i < media.length; i += 1) {
        setMedia((prev) =>
          prev.map((m, idx) => (idx === i ? { ...m, uploading: true } : m))
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
            prev.map((m, idx) => (idx === i ? { ...m, uploading: false } : m))
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
          <button
            onClick={() => router.push("/community")}
            disabled={submitting}
            className="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
          >
            취소하기
          </button>
          <h1 className="text-base font-bold text-gray-900">새 게시물</h1>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
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

        {/* 湲 ?묒꽦 ?곸뿭 */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="?쒕ぉ"
            className="mb-3 w-full border-b border-gray-100 bg-white pb-3 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="臾댁뒯 ?앷컖???섍퀬 怨꾩떊媛??"
            rows={10}
            className="w-full resize-none bg-white text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
          />

          {/* 誘몃뵒??誘몃━蹂닿린 */}
          <MediaPreview media={media} onRemove={handleRemoveMedia} />
        </div>

        {/* 移댄뀒怨좊━ */}
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">移댄뀒怨좊━</p>
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

        {/* ?뚯씪 泥⑤? ?대컮 */}
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              ?뚯씪 泥⑤?
              <span className="ml-1.5 text-gray-300">
              ({media.length}/{MAX_FILES}) 쨌 理쒕? {MAX_FILE_SIZE_MB}MB 쨌 PDF/臾몄꽌 媛??              </span>
            </p>
          </div>

          <div className="mt-2 flex gap-2">
            {/* ?ъ쭊 */}
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
              ?벜 ?ъ쭊
            </button>

            {/* ?숈쁺??*/}
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
              ?렏 ?숈쁺??            </button>

            {/* ?쇰컲 ?뚯씪 */}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "file")}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={submitting || media.length >= MAX_FILES}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              ?뱨 ?뚯씪
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}







