"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  PostDetail,
  CommentItem as CommentItemType,
  User,
  ReactionType,
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
} from "../_lib/api";
import {
  timeAgo,
  tempId,
  buildCommentTree,
  updateCommentInTree,
  removeCommentFromTree,
} from "../_lib/utils";
import Avatar from "../_components/Avatar";
import CommentItem from "../_components/CommentItem";
import LoginModal from "../_components/LoginModal";

const CATEGORIES = ["IT/소프트웨어", "경영/경제", "디자인", "AI/데이터", "기타"];

export default function PostDetailPage() {
  const router = useRouter();
  const { postId } = useParams<{ postId: string }>();
  const pid = Number(postId);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── 인증 ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setIsLoggedIn(true);
      const raw = localStorage.getItem("user");
      if (raw) setCurrentUser(JSON.parse(raw));
      // TODO: /me API로 교체
    }
  }, []);

  // ── 게시물 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingPost(true);
      try {
        const data = await getPost(pid);
        setPost(data);
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

  // ── 댓글 로드 ────────────────────────────────────────────────────────────────
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await getComments(pid, { page_size: 100 });
      // BE가 최상위 댓글만 내려주므로 대댓글은 별도 처리 필요
      // 현재 BE는 parent_comment_id가 null인 것만 내려줌 → 대댓글은 reply_count로 표시
      setComments(res.comments.map((c) => ({ ...c, replies: [] })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  }, [pid]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ── 게시물 반응 ──────────────────────────────────────────────────────────────
  const handleReactPost = async (type: ReactionType) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    if (!post) return;
    try {
      const res = await reactToPost(pid, type);
      setPost((p) => {
        if (!p) return p;
        const wasMyReaction = p.user_reaction === type;
        return {
          ...p,
          user_reaction: wasMyReaction ? null : type,
          reaction_stats: {
            ...p.reaction_stats,
            [type]: wasMyReaction
              ? p.reaction_stats[type] - 1
              : p.reaction_stats[type] + 1,
          },
        };
      });
    } catch (e) {
      console.error(e);
    }
  };

  // ── 게시물 수정 ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updatePost(pid, {
        title: editTitle.trim() || undefined,
        content: editContent.trim(),
        category: editCategory || undefined,
      });
      setPost(updated as PostDetail);
      setEditing(false);
    } catch (e: any) {
      alert(e.message ?? "수정에 실패했어요.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── 게시물 삭제 ──────────────────────────────────────────────────────────────
  const handleDeletePost = async () => {
    if (!confirm("게시물을 삭제할까요?")) return;
    try {
      await deletePost(pid);
      router.push("/community");
    } catch (e: any) {
      alert(e.message ?? "삭제에 실패했어요.");
    }
  };

  // ── 댓글 작성 ────────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) return;
    setSubmittingComment(true);
    try {
      const newComment = await createComment(pid, {
        content: commentText.trim(),
        parent_comment_id: null,
      });
      setComments((prev) => [...prev, { ...newComment, replies: [] }]);
      setCommentText("");
      setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
    } catch (e: any) {
      alert(e.message ?? "댓글 작성에 실패했어요.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── 대댓글 작성 ──────────────────────────────────────────────────────────────
  const handleAddReply = async (parentId: number, content: string) => {
    if (!currentUser) return;
    try {
      const newReply = await createComment(pid, {
        content,
        parent_comment_id: parentId,
      });
      setComments((prev) =>
        updateCommentInTree(prev, parentId, (c) => ({
          ...c,
          replies: [...(c.replies ?? []), { ...newReply, replies: [] }],
          reply_count: c.reply_count + 1,
        }))
      );
      setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
    } catch (e: any) {
      alert(e.message ?? "답글 작성에 실패했어요.");
    }
  };

  // ── 댓글 반응 ────────────────────────────────────────────────────────────────
  const handleReactComment = async (commentId: number, type: ReactionType) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    try {
      await reactToComment(pid, commentId, type);
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (c) => {
          const wasMyReaction = c.user_reaction === type;
          return {
            ...c,
            user_reaction: wasMyReaction ? null : type,
            reaction_stats: {
              ...c.reaction_stats,
              [type]: wasMyReaction
                ? c.reaction_stats[type] - 1
                : c.reaction_stats[type] + 1,
            },
          };
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  // ── 댓글 수정 ────────────────────────────────────────────────────────────────
  const handleEditComment = async (commentId: number, content: string) => {
    try {
      const updated = await updateComment(pid, commentId, { content });
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (c) => ({ ...c, content: updated.content }))
      );
    } catch (e: any) {
      alert(e.message ?? "수정에 실패했어요.");
    }
  };

  // ── 댓글 삭제 ────────────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    try {
      await deleteComment(pid, commentId);
      setComments((prev) => removeCommentFromTree(prev, commentId));
      setPost((p) => p ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p);
    } catch (e: any) {
      alert(e.message ?? "삭제에 실패했어요.");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">

        {/* Back */}
        <button
          onClick={() => router.push("/community")}
          className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
        >
          ← 자유게시판
        </button>

        {/* Post */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

          {/* Author + menu */}
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
                      <span>{post.category}</span>
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

          {/* Content */}
          {editing ? (
            <div className="mb-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목 (선택사항)"
                className="mb-3 w-full border-b border-gray-100 pb-3 text-base font-semibold text-gray-900 placeholder-gray-300 outline-none"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm focus:border-red-400 focus:outline-none"
              />
              {/* 카테고리 */}
              <div className="mt-3 flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setEditCategory(editCategory === cat ? "" : cat)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      editCategory === cat
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-red-300"
                    }`}
                  >
                    {cat}
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
                <h2 className="mb-2 text-lg font-bold text-gray-900">
                  {post.title}
                </h2>
              )}
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {post.content}
              </p>
            </>
          )}

          {/* Reactions */}
          {!editing && (
            <div className="mt-4 flex items-center gap-3 border-t border-gray-50 pt-4">
              {(["like", "interested", "helpful", "curious"] as ReactionType[]).map((type) => {
                const EMOJI: Record<ReactionType, string> = {
                  like: "❤️",
                  interested: "🤔",
                  helpful: "👍",
                  curious: "🧐",
                };
                const count = post.reaction_stats[type];
                const isActive = post.user_reaction === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleReactPost(type)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                      isActive
                        ? "border-red-300 bg-red-50 text-red-500"
                        : "border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400"
                    }`}
                  >
                    {EMOJI[type]} {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
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
            <p className="mb-4 text-center text-xs text-gray-400">
              첫 댓글을 남겨보세요 💬
            </p>
          ) : (
            <div className="mb-4 divide-y divide-gray-50">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onReact={(cid, type) => {
                    if (!currentUser) { setShowLoginModal(true); return; }
                    handleReactComment(cid, type);
                  }}
                  onReply={(parentId, text) => {
                    if (!currentUser) { setShowLoginModal(true); return; }
                    handleAddReply(parentId, text);
                  }}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  currentUserId={currentUser?.id ?? -1}
                />
              ))}
            </div>
          )}

          {/* 댓글 입력 */}
          {currentUser ? (
            <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
              <Avatar user={currentUser} size={32} />
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                placeholder="댓글을 입력하세요..."
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-red-400 focus:outline-none"
              />
              <button
                onClick={handleAddComment}
                disabled={submittingComment || !commentText.trim()}
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {submittingComment ? "..." : "등록"}
              </button>
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
