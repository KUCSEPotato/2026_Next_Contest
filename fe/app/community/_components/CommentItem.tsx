"use client";

import { useState } from "react";
import { CommentItem as CommentItemType, ReactionType } from "../_types";
import { timeAgo } from "../_lib/utils";
import Avatar from "./Avatar";

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "❤️",
  interested: "🤔",
  helpful: "👍",
  curious: "🧐",
};

export default function CommentItem({
  comment,
  depth = 0,
  onReact,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: CommentItemType;
  depth?: number;
  onReact: (commentId: number, type: ReactionType) => void;
  onReply: (parentId: number, content: string) => void;
  onEdit: (commentId: number, content: string) => void;
  onDelete: (commentId: number) => void;
  currentUserId: number;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const isOwn = comment.author_id === currentUserId;

  const submitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setReplying(false);
  };

  const submitEdit = () => {
    if (!editText.trim()) return;
    onEdit(comment.id, editText.trim());
    setEditing(false);
  };

  const totalLikes = comment.reaction_stats.like;
  const myReaction = comment.user_reaction ?? null;

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-gray-100 pl-3" : ""}>
      <div className="flex gap-2 py-2">
        <Avatar user={comment.author} size={28} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-800">
              {comment.author.nickname}
            </span>
            <span className="text-[10px] text-gray-400">
              {timeAgo(comment.created_at)}
            </span>
          </div>

          {editing ? (
            <div className="mt-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
              />
              <div className="mt-1 flex gap-1">
                <button
                  onClick={submitEdit}
                  className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] text-white"
                >
                  수정완료
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border px-2 py-0.5 text-[10px] text-gray-500"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-700">
              {comment.content}
            </p>
          )}

          <div className="mt-1 flex items-center gap-3">
            {/* 좋아요 반응 */}
            <button
              onClick={() => onReact(comment.id, "like")}
              className={`flex items-center gap-1 text-[10px] transition ${
                myReaction === "like"
                  ? "text-red-500"
                  : "text-gray-400 hover:text-red-400"
              }`}
            >
              {myReaction === "like" ? "❤️" : "🤍"} {totalLikes}
            </button>

            {depth === 0 && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                답글
              </button>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >
                  수정
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-[10px] text-gray-400 hover:text-red-500"
                >
                  삭제
                </button>
              </>
            )}
          </div>

          {replying && (
            <div className="mt-2 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReply()}
                placeholder="답글을 입력하세요..."
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
              />
              <button
                onClick={submitReply}
                className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-medium text-white"
              >
                등록
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies?.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          depth={depth + 1}
          onReact={onReact}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}