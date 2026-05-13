// ─── BE 응답 기반 타입 ────────────────────────────────────────────────────────

export type ReactionType = "recommend" | "not_recommend";

export interface ReactionStats {
  recommend: number;
  not_recommend: number;
}

export const EMPTY_REACTION_STATS: ReactionStats = {
  recommend: 0,
  not_recommend: 0,
};

export interface AuthorInfo {
  id: number | null;
  nickname: string;
  avatar_url: string | null;
  role?: string | null;
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
  user_reaction: ReactionType | null; // BE 추가 필드
}

/** GET /community/{post_id} 상세 */
export interface PostDetail extends PostSummary {
  user_reaction: ReactionType | null;
}

/** GET /community/{post_id}/files 첨부 파일 */
export interface PostFile {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  s3_url: string;
  uploaded_at: string;
}

/** GET /community/{post_id}/comments 댓글 아이템 */
export interface CommentItem {
  id: number;
  post_id: number;
  author_id: number | null;
  content: string;
  parent_comment_id: number | null;
  is_anonymous?: boolean;
  /** 로그인한 경우, 본인 댓글 여부 (익명 댓글 수정·삭제 UI용) */
  is_mine?: boolean;
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
