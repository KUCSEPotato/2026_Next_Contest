"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostFile, User } from "../../_types";
import {
  deletePostFile,
  getPost,
  getPostFiles,
  updatePost,
  uploadPostFile,
} from "../../_lib/api";
import MediaPreview, { MediaItem } from "../../_components/MediaPreview";
import { useDialog } from "../../../../components/AppFeedback";

const CATEGORIES = [
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
];

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 50;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getMediaType = (file: File): MediaItem["type"] => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

export default function EditPostPage() {
  const router = useRouter();
  const { confirm } = useDialog();
  const { postId } = useParams<{ postId: string }>();
  const pid = Number(postId);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [existingFiles, setExistingFiles] = useState<PostFile[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      let user: User | null = null;
      try {
        const raw = localStorage.getItem("user");
        if (raw) {
          user = JSON.parse(raw) as User;
          setCurrentUser(user);
        }
      } catch (e) {
        console.error("유저 정보 파싱 실패", e);
        localStorage.removeItem("user");
      }

      try {
        const [post, files] = await Promise.all([
          getPost(pid),
          getPostFiles(pid).catch(() => []),
        ]);

        if (user && user.id !== post.author_id) {
          router.replace(`/community/${pid}`);
          return;
        }

        setTitle(post.title ?? "");
        setContent(post.content);
        setCategory(post.category ?? "");
        setExistingFiles(files);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "게시물을 불러오지 못했어요."));
      } finally {
        setLoading(false);
      }
    });
  }, [pid, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    const overSize = files.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (overSize.length) {
      setError(`파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하만 가능해요.`);
      return;
    }

    if (existingFiles.length + media.length + files.length > MAX_FILES) {
      setError(`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    setError("");
    setMedia((prev) => [
      ...prev,
      ...files.map((file) => ({
        type: getMediaType(file),
        url: URL.createObjectURL(file),
        file,
      })),
    ]);
  };

  const handleRemoveMedia = (i: number) => {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleDeleteExistingFile = async (fileId: number) => {
    const ok = await confirm({
      title: "첨부 파일을 삭제할까요?",
      message: "삭제한 첨부 파일은 다시 복구하기 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) return;

    try {
      await deletePostFile(pid, fileId);
      setExistingFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "첨부 파일 삭제에 실패했어요."));
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await updatePost(pid, {
        title: title.trim() || undefined,
        content: content.trim(),
        category: category || undefined,
      });

      let failedUploadCount = 0;
      for (let i = 0; i < media.length; i += 1) {
        setMedia((prev) =>
          prev.map((m, idx) => (idx === i ? { ...m, uploading: true } : m))
        );

        try {
          const uploaded = await uploadPostFile(pid, media[i].file);
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
        alert(`게시물은 수정됐지만 파일 ${failedUploadCount}개 업로드에 실패했어요.`);
      }

      router.push(`/community/${pid}`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "게시물 수정에 실패했어요."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  const attachedFileCount = existingFiles.length + media.length;
  const fileLimitReached = submitting || attachedFileCount >= MAX_FILES;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(`/community/${pid}`)}
            disabled={submitting}
            className="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
          >
            취소하기
          </button>
          <h1 className="text-base font-bold text-gray-900">게시물 수정</h1>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="rounded-xl bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-500">
            {error}
          </div>
        )}

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
            placeholder="내용을 입력해주세요."
            rows={10}
            className="w-full resize-none bg-white text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-300"
          />
        </div>

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

        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              파일 첨부
              <span className="ml-1.5 text-gray-300">
                ({attachedFileCount}/{MAX_FILES}) · 최대 {MAX_FILE_SIZE_MB}MB
              </span>
            </p>
          </div>

          {existingFiles.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {existingFiles.map((file) => {
                const isImage = file.file_type.startsWith("image/");
                const isVideo = file.file_type.startsWith("video/");

                return (
                  <div key={file.id} className="relative overflow-hidden rounded-xl bg-gray-100">
                    {isImage ? (
                      <img
                        src={file.s3_url}
                        alt={file.filename}
                        className="h-36 w-full object-cover"
                      />
                    ) : isVideo ? (
                      <video
                        src={file.s3_url}
                        controls
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <a
                        href={file.s3_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-24 flex-col items-center justify-center gap-2 px-4 text-center text-xs font-medium text-gray-700 hover:text-red-500"
                      >
                        <span className="text-2xl">📎</span>
                        <span className="max-w-full truncate">{file.filename}</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteExistingFile(file.id)}
                      disabled={submitting}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <MediaPreview media={media} onRemove={handleRemoveMedia} />

          <div className="mt-3 flex gap-2">
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => imageRef.current?.click()}
              disabled={fileLimitReached}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              사진
            </button>

            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => videoRef.current?.click()}
              disabled={fileLimitReached}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              동영상
            </button>

            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={fileLimitReached}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              파일
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
