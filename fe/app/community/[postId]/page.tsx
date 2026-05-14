"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  PostDetail,
  CommentItem as CommentItemType,
  PostFile,
  User,
  ReactionType,
  EMPTY_REACTION_STATS,
} from "../_types";
import {
  getPost,
  updatePost,
  deletePost,
  reactToPost,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  reactToComment,
  getPostFiles,
} from "../_lib/api";
import {
  timeAgo,
  buildCommentTree,
  updateCommentInTree,
  removeCommentFromTree,
} from "../_lib/utils";
import Avatar from "../_components/Avatar";
import CommentItem from "../_components/CommentItem";
import LoginModal from "../_components/LoginModal";
import { ThumbDownIcon, ThumbUpIcon } from "../_components/ReactionThumbIcons";
import { createReportApi } from "../../../lib/api";
import { useDialog, useToast } from "../../../components/AppFeedback";

const CATEGORIES = [
  { label: "일반", value: "general" },
  { label: "질문", value: "question" },
  { label: "아이디어", value: "idea" },
  { label: "작업 공유", value: "showcase" },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "일반",
  question: "질문",
  idea: "아이디어",
  showcase: "작업 공유",
};

function getCategoryLabel(category?: string | null) {
  if (!category) return "";
  return CATEGORY_LABELS[category] || category;
}

const REACTIONS: {
  type: ReactionType;
  Icon: typeof ThumbUpIcon;
  inactiveClass: string;
  activeClass: string;
}[] = [
  {
    type: "recommend",
    Icon: ThumbUpIcon,
    inactiveClass:
      "border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 [&_svg]:text-gray-400 hover:[&_svg]:text-red-600",
    activeClass: "border-red-300 bg-red-50 text-red-600 [&_svg]:text-red-600",
  },
  {
    type: "not_recommend",
    Icon: ThumbDownIcon,
    inactiveClass:
      "border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 [&_svg]:text-gray-400 hover:[&_svg]:text-red-600",
    activeClass: "border-red-300 bg-red-50 text-red-600 [&_svg]:text-red-600",
  },
];

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function PostDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { prompt, confirm } = useDialog();
  const { postId } = useParams<{ postId: string }>();
  const pid = Number(postId);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [files, setFiles] = useState<PostFile[]>([]);
  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [commentText, setCommentText] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const postReactBusy = useRef(false);
  const commentReactBusy = useRef(new Set<number>());

  useEffect(() => {
    Promise.resolve().then(() => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const raw = localStorage.getItem("user");
          if (raw) setCurrentUser(JSON.parse(raw) as User);
        } catch (e) {
          console.error("유저 정보 파싱 실패", e);
          localStorage.removeItem("user");
        }
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingPost(true);
      try {
        const [data, fileData] = await Promise.all([
          getPost(pid),
          getPostFiles(pid).catch(() => []),
        ]);
        setPost(data);
        setFiles(fileData);
        setEditTitle(data.title ?? "");
        setEditContent(data.content);
        setEditCategory(data.category ?? "");
      } catch {
        setPost(null);
      } finally {
        setLoadingPost(false);
      }
    })();
  }, [pid]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await getComments(pid, { page_size: 100 });
      setComments(buildCommentTree(res.comments));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  }, [pid]);

  useEffect(() => {
    Promise.resolve().then(() => loadComments());
  }, [loadComments]);

  // ── 게시물 반응 (단일 선택) ──────────────────────────────────────────────────
  const handleReactPost = async (type: ReactionType) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    if (!post) return;
    if (postReactBusy.current) return;
    postReactBusy.current = true;
    try {
      const result = await reactToPost(pid, type);
      setPost((p) => {
        if (!p) return p;
        if (result.reaction_stats) {
          return {
            ...p,
            user_reaction: result.user_reaction ?? null,
            reaction_stats: result.reaction_stats,
          };
        }
        const newStats = { ...p.reaction_stats };
        if (result.action === "removed") {
          const rt = result.reaction_type;
          newStats[rt] = Math.max(0, newStats[rt] - 1);
          return { ...p, user_reaction: null, reaction_stats: newStats };
        }
        const prevReaction = p.user_reaction;
        if (prevReaction && prevReaction !== type) {
          newStats[prevReaction] = Math.max(0, newStats[prevReaction] - 1);
        }
        newStats[type] = newStats[type] + 1;
        return {
          ...p,
          user_reaction: type,
          reaction_stats: newStats,
        };
      });
    } catch (e) {
      console.error(e);
    } finally {
      postReactBusy.current = false;
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updatePost(pid, {
        title: editTitle.trim() || undefined,
        content: editContent.trim(),
        category: editCategory || undefined,
      });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              comment_count: updated.comment_count ?? prev.comment_count,
              reaction_stats: updated.reaction_stats ?? prev.reaction_stats,
              user_reaction: updated.user_reaction ?? prev.user_reaction,
            }
          : (updated as PostDetail)
      );
      setEditing(false);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "수정에 실패했어요."));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async () => {
    const ok = await confirm({
      title: "게시물을 삭제할까요?",
      message: "삭제한 게시물은 다시 복구하기 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deletePost(pid);
      router.push("/community");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "삭제에 실패했어요."));
    }
  };

  const handleReport = async (targetType: "post" | "comment", targetId: number, label: string) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    const reasonInput = await prompt({
      title: `${label} 신고`,
      message: "관리자가 확인할 수 있도록 신고 사유를 입력해주세요.",
      placeholder: "문제가 되는 이유를 입력하세요.",
      confirmText: "신고하기",
      required: true,
      multiline: true,
      tone: "danger",
    });
    if (reasonInput === null) return;

    try {
      await createReportApi({
        target_type: targetType,
        target_id: targetId,
        reason: reasonInput.trim(),
      });
      toast.success("신고가 접수되었습니다.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "신고 접수에 실패했어요."));
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) return;
    setSubmittingComment(true);
    try {
      const newComment = await createComment(pid, {
        content: commentText.trim(),
        parent_comment_id: null,
        is_anonymous: commentAnonymous,
      });
      setComments((prev) => [...prev, {
        ...newComment,
        replies: [],
        reply_count: newComment.reply_count ?? 0,
        reaction_stats: newComment.reaction_stats ?? { ...EMPTY_REACTION_STATS },
        user_reaction: newComment.user_reaction ?? null,
        updated_at: newComment.updated_at ?? newComment.created_at,
      }]);
      setCommentText("");
      setCommentAnonymous(false);
      setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "댓글 작성에 실패했어요."));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (parentId: number, content: string, isAnonymous: boolean) => {
    if (!currentUser) return;
    try {
      const newReply = await createComment(pid, {
        content,
        parent_comment_id: parentId,
        is_anonymous: isAnonymous,
      });
      setComments((prev) =>
        updateCommentInTree(prev, parentId, (c) => ({
          ...c,
          replies: [...(c.replies ?? []), {
            ...newReply,
            replies: [],
            reply_count: newReply.reply_count ?? 0,
            reaction_stats: newReply.reaction_stats ?? { ...EMPTY_REACTION_STATS },
            user_reaction: newReply.user_reaction ?? null,
            updated_at: newReply.updated_at ?? newReply.created_at,
          }],
          reply_count: c.reply_count + 1,
        }))
      );
      setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "답글 작성에 실패했어요."));
    }
  };

  // ── 댓글 반응 (단일 선택) ────────────────────────────────────────────────────
  const handleReactComment = async (commentId: number, type: ReactionType) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    if (commentReactBusy.current.has(commentId)) return;
    commentReactBusy.current.add(commentId);
    try {
      const result = await reactToComment(pid, commentId, type);
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (c) => {
          if (result.reaction_stats) {
            return {
              ...c,
              user_reaction: result.user_reaction ?? null,
              reaction_stats: result.reaction_stats,
            };
          }
          const newStats = { ...c.reaction_stats };
          if (result.action === "removed") {
            const rt = result.reaction_type;
            newStats[rt] = Math.max(0, newStats[rt] - 1);
            return {
              ...c,
              user_reaction: null,
              reaction_stats: newStats,
            };
          }
          const prevReaction = c.user_reaction;
          if (prevReaction && prevReaction !== type) {
            newStats[prevReaction] = Math.max(0, newStats[prevReaction] - 1);
          }
          newStats[type] = newStats[type] + 1;
          return {
            ...c,
            user_reaction: type,
            reaction_stats: newStats,
          };
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      commentReactBusy.current.delete(commentId);
    }
  };

  const handleEditComment = async (commentId: number, content: string) => {
    try {
      const updated = await updateComment(pid, commentId, { content });
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (c) => ({ ...c, content: updated.content }))
      );
    } catch (e: unknown) {
      alert(getErrorMessage(e, "수정에 실패했어요."));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const ok = await confirm({
      title: "댓글을 삭제할까요?",
      message: "삭제한 댓글은 다시 복구하기 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteComment(pid, commentId);
      setComments((prev) => removeCommentFromTree(prev, commentId));
      setPost((p) => p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "삭제에 실패했어요."));
    }
  };

  if (loadingPost) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">게시물을 찾을 수 없어요.</p>
        <button
          onClick={() => router.push("/community")}
          className="text-xs text-red-500 underline"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const isOwn = currentUser?.id === post.author_id;
  const isAdminPost = post.author?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">

        <button
          onClick={() => router.push("/community")}
          className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
        >
          ← 모닥불
        </button>

        {/* Post */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar user={post.author} size={42} />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {post.author.nickname}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{timeAgo(post.created_at)}</span>
                  {post.category && (
                    <>
                      <span>·</span>
                      <span>{getCategoryLabel(post.category)}</span>
                    </>
                  )}
                  <span>· 조회 {post.view_count}</span>
                </div>
              </div>
            </div>

            {isOwn && !editing && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  •••
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-10 min-w-[100px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => { setEditing(true); setMenuOpen(false); }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleDeletePost(); }}
                      className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mb-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목 (선택사항)"
                className="mb-3 w-full border-b border-gray-100 bg-white pb-3 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setEditCategory(editCategory === cat.value ? "" : cat.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      editCategory === cat.value
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-red-300"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editContent.trim()}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {savingEdit ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.title && (
                <h2 className="mb-2 text-lg font-bold text-gray-900">{post.title}</h2>
              )}
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {post.content}
              </p>
              {files.length > 0 && (
                <div
                  className={`mt-4 grid gap-2 ${
                    files.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {files.map((file) => {
                    const isImage = file.file_type.startsWith("image/");
                    const isVideo = file.file_type.startsWith("video/");

                    return (
                      <div
                        key={file.id}
                        className="overflow-hidden rounded-xl border border-gray-100 bg-gray-100"
                      >
                        {isImage ? (
                          <img
                            src={file.s3_url}
                            alt={file.filename}
                            className="max-h-[520px] w-full bg-gray-50 object-contain"
                          />
                        ) : isVideo ? (
                          <video
                            src={file.s3_url}
                            controls
                            className="max-h-[520px] w-full bg-black object-contain"
                          />
                        ) : (
                          <a
                            href={file.s3_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:text-red-500"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg">
                              📄
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate">{file.filename}</span>
                              <span className="mt-1 block text-xs text-gray-400">
                                {(file.file_size / 1024 / 1024).toFixed(2)}MB
                              </span>
                            </span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!editing && (
            <div className="mt-4 flex items-center gap-2 border-t border-gray-50 pt-4">
              {REACTIONS.map(({ type, Icon, inactiveClass, activeClass }) => {
                const count = post.reaction_stats[type];
                const isActive = post.user_reaction === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleReactPost(type)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      isActive ? activeClass : inactiveClass
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {count > 0 && <span className="tabular-nums">{count}</span>}
                  </button>
                );
              })}
              {!isOwn && !isAdminPost && (
                <button
                  onClick={() => handleReport("post", post.id, "게시글")}
                  className="ml-auto rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:border-red-200 hover:text-red-600"
                >
                  신고
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-900">
            댓글 {post.comment_count}
          </h2>

          {loadingComments ? (
            <p className="py-8 text-center text-xs text-gray-400">댓글 불러오는 중...</p>
          ) : comments.length === 0 ? (
            <p className="mb-4 text-center text-xs text-gray-400">첫 댓글을 남겨보세요 💬</p>
          ) : (
            <div className="mb-4 divide-y divide-gray-50 dark:divide-slate-800/70">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onReact={(cid, type) => {
                    if (!currentUser) { setShowLoginModal(true); return; }
                    handleReactComment(cid, type);
                  }}
                  onReply={(parentId, text, isAnonymous) => {
                    if (!currentUser) { setShowLoginModal(true); return; }
                    handleAddReply(parentId, text, isAnonymous);
                  }}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onReport={(commentId) => handleReport("comment", commentId, "댓글")}
                  currentUserId={currentUser?.id ?? -1}
                />
              ))}
            </div>
          )}

          {currentUser ? (
            <div className="space-y-2 border-t border-gray-50 pt-4 dark:border-slate-800/70">
              <div className="flex items-center gap-2">
                <Avatar user={currentUser} size={32} />
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {submittingComment ? "..." : "등록"}
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pl-10 text-[11px] text-gray-500">
                <input
                  type="checkbox"
                  checked={commentAnonymous}
                  onChange={(e) => setCommentAnonymous(e.target.checked)}
                  className="rounded border-gray-300"
                />
                익명으로 댓글 달기
              </label>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="mt-2 w-full rounded-xl border border-dashed border-gray-200 py-2.5 text-xs text-gray-400 transition hover:border-red-300 hover:text-red-400"
            >
              댓글 작성은 로그인 후 이용 가능해요
            </button>
          )}
        </div>
      </main>

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => router.push("/login")}
        />
      )}
    </div>
  );
}
