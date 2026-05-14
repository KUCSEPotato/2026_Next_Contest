"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CommentItem as CommentItemType,
  EMPTY_REACTION_STATS,
  PostDetail,
  ReactionType,
  User,
} from "../../community/_types";
import {
  createComment,
  deleteComment,
  getComments,
  getPost,
  reactToComment,
  updateComment,
} from "../../community/_lib/api";
import {
  buildCommentTree,
  removeCommentFromTree,
  timeAgo,
  updateCommentInTree,
} from "../../community/_lib/utils";
import Avatar from "../../community/_components/Avatar";
import CommentItem from "../../community/_components/CommentItem";
import LoginModal from "../../community/_components/LoginModal";
import { NOTICE_READ_IDS_STORAGE_KEY } from "../../../components/TopActionButtons";

function markNoticeAsRead(noticeId: number) {
  if (typeof window === "undefined") return;

  try {
    const parsed = JSON.parse(localStorage.getItem(NOTICE_READ_IDS_STORAGE_KEY) || "[]");
    const readIds = new Set(
      Array.isArray(parsed)
        ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : []
    );
    readIds.add(noticeId);
    localStorage.setItem(NOTICE_READ_IDS_STORAGE_KEY, JSON.stringify([...readIds]));
  } catch {
    localStorage.setItem(NOTICE_READ_IDS_STORAGE_KEY, JSON.stringify([noticeId]));
  }
}

export default function NoticeDetailPage() {
  const router = useRouter();
  const { postId } = useParams<{ postId: string }>();
  const noticeId = Number(postId);
  const [notice, setNotice] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const commentSubmitBusy = useRef(false);
  const replySubmitBusy = useRef(new Set<number>());
  const commentReactBusy = useRef(new Set<number>());

  const loadNotice = useCallback(async () => {
    if (!Number.isFinite(noticeId)) {
      setError("공지 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getPost(noticeId);
      if (!["announcement", "event"].includes(data.category || "")) {
        setError("공지 정보를 찾을 수 없습니다.");
        setNotice(null);
        return;
      }
      setNotice(data);
      markNoticeAsRead(data.id);
    } catch (err) {
      console.error(err);
      setError("공지 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadNotice();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotice]);

  useEffect(() => {
    Promise.resolve().then(() => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const raw = localStorage.getItem("user");
        if (raw) setCurrentUser(JSON.parse(raw) as User);
      } catch (e) {
        console.error(e);
        localStorage.removeItem("user");
      }
    });
  }, []);

  const isEventNotice = notice?.category === "event";

  const loadComments = useCallback(async () => {
    if (!Number.isFinite(noticeId)) return;

    setLoadingComments(true);
    try {
      const res = await getComments(noticeId, { page_size: 100 });
      setComments(buildCommentTree(res.comments));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  }, [noticeId]);

  useEffect(() => {
    if (!isEventNotice) {
      Promise.resolve().then(() => setComments([]));
      return;
    }

    Promise.resolve().then(() => loadComments());
  }, [isEventNotice, loadComments]);

  const handleAddComment = async () => {
    const content = commentText.trim();
    if (!content || !currentUser || commentSubmitBusy.current) return;

    commentSubmitBusy.current = true;
    setSubmittingComment(true);
    try {
      const newComment = await createComment(noticeId, {
        content,
        parent_comment_id: null,
        is_anonymous: commentAnonymous,
      });
      setComments((prev) => {
        if (prev.some((comment) => comment.id === newComment.id)) return prev;

        return [
          ...prev,
          {
            ...newComment,
            replies: [],
            reply_count: newComment.reply_count ?? 0,
            reaction_stats: newComment.reaction_stats ?? { ...EMPTY_REACTION_STATS },
            user_reaction: newComment.user_reaction ?? null,
            updated_at: newComment.updated_at ?? newComment.created_at,
          },
        ];
      });
      setNotice((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev));
      setCommentText("");
      setCommentAnonymous(false);
    } catch (e) {
      console.error(e);
      alert("댓글 작성에 실패했습니다.");
    } finally {
      commentSubmitBusy.current = false;
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (parentId: number, content: string, isAnonymous: boolean) => {
    if (!currentUser || replySubmitBusy.current.has(parentId)) return;

    replySubmitBusy.current.add(parentId);
    try {
      const newReply = await createComment(noticeId, {
        content,
        parent_comment_id: parentId,
        is_anonymous: isAnonymous,
      });
      setComments((prev) =>
        updateCommentInTree(prev, parentId, (comment) => ({
          ...comment,
          replies: [
            ...(comment.replies ?? []),
            {
              ...newReply,
              replies: [],
              reply_count: newReply.reply_count ?? 0,
              reaction_stats: newReply.reaction_stats ?? { ...EMPTY_REACTION_STATS },
              user_reaction: newReply.user_reaction ?? null,
              updated_at: newReply.updated_at ?? newReply.created_at,
            },
          ],
          reply_count: comment.reply_count + 1,
        }))
      );
      setNotice((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev));
    } catch (e) {
      console.error(e);
      alert("답글 작성에 실패했습니다.");
    } finally {
      replySubmitBusy.current.delete(parentId);
    }
  };

  const handleReactComment = async (commentId: number, type: ReactionType) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    if (commentReactBusy.current.has(commentId)) return;

    commentReactBusy.current.add(commentId);
    try {
      const result = await reactToComment(noticeId, commentId, type);
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (comment) => ({
          ...comment,
          user_reaction: result.user_reaction ?? null,
          reaction_stats: result.reaction_stats ?? comment.reaction_stats,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      commentReactBusy.current.delete(commentId);
    }
  };

  const handleEditComment = async (commentId: number, content: string) => {
    try {
      const updated = await updateComment(noticeId, commentId, { content });
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (comment) => ({ ...comment, content: updated.content }))
      );
    } catch (e) {
      console.error(e);
      alert("수정에 실패했습니다.");
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm("댓글을 삭제할까요?")) return;

    try {
      await deleteComment(noticeId, commentId);
      setComments((prev) => removeCommentFromTree(prev, commentId));
      setNotice((prev) =>
        prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev
      );
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        공지를 불러오는 중...
      </div>
    );
  }

  if (!notice || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <p className="text-sm text-gray-500">{error || "공지 정보를 찾을 수 없습니다."}</p>
        <button
          type="button"
          onClick={() => router.push("/notices")}
          className="text-xs text-red-500 underline"
        >
          공지 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const title = isEventNotice
    ? `[이벤트] ${notice.title || "제목 없는 공지"}`
    : notice.title || "제목 없는 공지";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <button
          type="button"
          onClick={() => router.push("/notices")}
          className="mb-5 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          공지 목록
        </button>

        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4" />

          <div className="p-5">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-bold text-red-600">
                관
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-7 text-gray-900">
                  {title}
                </h1>
                <p className="mt-1 text-xs font-semibold text-red-600">관리자</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>게시자 관리자</span>
                  <span>·</span>
                  <span>{timeAgo(notice.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
              {notice.content}
            </div>

            {!isEventNotice && (
              <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-400">
                공지사항에는 댓글을 작성할 수 없습니다.
              </p>
            )}
          </div>
        </article>

        {isEventNotice && (
          <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-900">
              댓글 {notice.comment_count}
            </h2>

            {loadingComments ? (
              <p className="py-8 text-center text-xs text-gray-400">댓글을 불러오는 중...</p>
            ) : comments.length === 0 ? (
              <p className="mb-4 text-center text-xs text-gray-400">첫 댓글을 남겨보세요.</p>
            ) : (
              <div className="mb-4 divide-y divide-gray-50">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onReact={handleReactComment}
                    onReply={(parentId, text, isAnonymous) => {
                      if (!currentUser) {
                        setShowLoginModal(true);
                        return;
                      }
                      handleAddReply(parentId, text, isAnonymous);
                    }}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                    onReport={() => {}}
                    currentUserId={currentUser?.id ?? -1}
                  />
                ))}
              </div>
            )}

            {currentUser ? (
              <div className="space-y-2 border-t border-gray-50 pt-4">
                <div className="flex items-center gap-2">
                  <Avatar user={currentUser} size={32} />
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return;
                      e.preventDefault();
                      handleAddComment();
                    }}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none"
                  />
                  <button
                    type="button"
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
                  익명으로 댓글 쓰기
                </label>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="mt-2 w-full rounded-xl border border-dashed border-gray-200 py-2.5 text-xs text-gray-400 transition hover:border-red-300 hover:text-red-400"
              >
                댓글 작성은 로그인 후 이용할 수 있어요.
              </button>
            )}
          </section>
        )}
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
