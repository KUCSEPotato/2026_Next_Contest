import { PostSummary, PostDetail, CommentItem, ReactionType } from "../_types";

const BASE = "/api/community";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(params?: {
  category?: string;
  page?: number;
  page_size?: number;
}): Promise<{ posts: PostSummary[]; total: number; page: number; total_pages: number }> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const res = await fetch(`${BASE}?${qs}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getPost(postId: number): Promise<PostDetail> {
  const res = await fetch(`${BASE}/${postId}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createPost(payload: {
  title: string;
  content: string;
  category?: string;
}): Promise<PostDetail> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updatePost(
  postId: number,
  payload: { title?: string; content?: string; category?: string }
): Promise<PostDetail> {
  const res = await fetch(`${BASE}/${postId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deletePost(postId: number): Promise<void> {
  const res = await fetch(`${BASE}/${postId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}

export async function reactToPost(
  postId: number,
  reactionType: ReactionType
): Promise<{ action: "added" | "removed"; reaction_type: ReactionType }> {
  const res = await fetch(`${BASE}/${postId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return handleResponse(res);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(
  postId: number,
  params?: { page?: number; page_size?: number }
): Promise<{ comments: CommentItem[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const res = await fetch(`${BASE}/${postId}/comments?${qs}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function createComment(
  postId: number,
  payload: { content: string; parent_comment_id?: number | null }
): Promise<CommentItem> {
  const res = await fetch(`${BASE}/${postId}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateComment(
  postId: number,
  commentId: number,
  payload: { content: string }
): Promise<CommentItem> {
  const res = await fetch(`${BASE}/${postId}/comments/${commentId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteComment(
  postId: number,
  commentId: number
): Promise<void> {
  const res = await fetch(`${BASE}/${postId}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}

export async function reactToComment(
  postId: number,
  commentId: number,
  reactionType: ReactionType
): Promise<{ action: "added" | "removed"; reaction_type: ReactionType }> {
  const res = await fetch(`${BASE}/${postId}/comments/${commentId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return handleResponse(res);
}
