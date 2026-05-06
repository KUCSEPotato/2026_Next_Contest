"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PostSummary, User, ReactionType } from "../_types";
import { timeAgo } from "../_lib/utils";
import Avatar from "./Avatar";

interface PostCardProps {
  post: PostSummary;
  currentUser: User | null;
  onReact: (postId: number, type: ReactionType) => void;
  onDelete: (postId: number) => void;
  onLoginRequired: () => void;
}

export default function PostCard({
  post,
  currentUser,
  onReact,
  onDelete,
  onLoginRequired,
}: PostCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwn = currentUser?.id === post.author_id;
  const totalLikes = post.reaction_stats.like;

  // 목록에서는 liked 상태를 알 수 없으므로 상세에서 처리
  const goToDetail = () => router.push(`/community/${post.id}`);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar user={post.author} size={38} />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {post.author.nickname}
            </p>
            <p className="text-[11px] text-gray-400">
              {timeAgo(post.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {post.is_pinned && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
              📌 고정
            </span>
          )}
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                •••
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-10 min-w-[100px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/community/${post.id}/edit`);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(post.id);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content — 클릭 시 상세 이동 */}
      <div className="cursor-pointer" onClick={goToDetail}>
        {post.title && (
          <p className="mb-1 text-sm font-semibold text-gray-900 line-clamp-1">
            {post.title}
          </p>
        )}
        <p className="mb-2 line-clamp-3 text-sm leading-relaxed text-gray-700">
          {post.content}
        </p>
      </div>

      {/* Category */}
      {post.category && (
        <span className="mb-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
          {post.category}
        </span>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-4 border-t border-gray-50 pt-3">
        <button
          onClick={() => {
            if (!currentUser) { onLoginRequired(); return; }
            onReact(post.id, "like");
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-red-400"
        >
          🤍 <span className="text-xs">{totalLikes}</span>
        </button>

        <button
          onClick={goToDetail}
          className="flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-gray-600"
        >
          💬 <span>{post.comment_count}</span>
        </button>

        <span className="ml-auto text-[10px] text-gray-300">
          👁 {post.view_count}
        </span>
      </div>
    </div>
  );
}
