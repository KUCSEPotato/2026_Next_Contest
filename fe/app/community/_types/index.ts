// ─── BE 응답 기반 타입 ────────────────────────────────────────────────────────

export type ReactionType = "like" | "interested" | "helpful" | "curious";

export interface ReactionStats {
  like: number;
  interested: number;
  helpful: number;
  curious: number;
}

export interface AuthorInfo {
  id: number;
  nickname: string;
  avatar_url: string | null;
}

/** GET /community 목록 아이템 */
export interface PostSummary {
  id: number;
  author_id: number;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  author: AuthorInfo;
  comment_count: number;
  reaction_stats: ReactionStats;
}

/** GET /community/{post_id} 상세 */
export interface PostDetail extends PostSummary {
  user_reaction: ReactionType | null;
}

/** GET /community/{post_id}/comments 댓글 아이템 */
export interface CommentItem {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  author: AuthorInfo;
  reaction_stats: ReactionStats;
  reply_count: number;
  // 프론트에서 조립하는 필드
  replies?: CommentItem[];
  user_reaction?: ReactionType | null;
}

// ─── 프론트 내부 상태용 ───────────────────────────────────────────────────────

export interface User {
  id: number;
  nickname: string;
  avatar_url?: string | null;
}