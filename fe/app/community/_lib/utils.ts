import { CommentItem } from "../_types";

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

let _tempId = -1;
export const tempId = () => _tempId--;

/** 플랫한 댓글 배열 → 트리 구조로 조립 (BE가 플랫으로 내려줄 경우 대비) */
export function buildCommentTree(comments: CommentItem[]): CommentItem[] {
  const map = new Map<number, CommentItem>();
  const roots: CommentItem[] = [];

  comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  map.forEach((c) => {
    if (c.parent_comment_id == null) {
      roots.push(c);
    } else {
      const parent = map.get(c.parent_comment_id);
      if (parent) parent.replies!.push(c);
    }
  });
  return roots;
}

export function updateCommentInTree(
  comments: CommentItem[],
  id: number,
  updater: (c: CommentItem) => CommentItem
): CommentItem[] {
  return comments.map((c) => {
    if (c.id === id) return updater(c);
    if (c.replies?.length)
      return { ...c, replies: updateCommentInTree(c.replies, id, updater) };
    return c;
  });
}

export function removeCommentFromTree(
  comments: CommentItem[],
  id: number
): CommentItem[] {
  return comments
    .filter((c) => c.id !== id)
    .map((c) => ({
      ...c,
      replies: c.replies ? removeCommentFromTree(c.replies, id) : [],
    }));
}

export function totalReactions(stats: {
  like: number;
  interested: number;
  helpful: number;
  curious: number;
}): number {
  return stats.like + stats.interested + stats.helpful + stats.curious;
}