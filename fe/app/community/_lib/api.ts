import { PostSummary, PostDetail, CommentItem, ReactionType, PostFile } from "../_types";
import { authenticatedFetch, getApiBaseUrl, getToken } from "../../../lib/auth";

const BASE = `${getApiBaseUrl()}/api/v1/community`;

function authHeaders(): HeadersInit {
  const token = getToken();
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
  sort_by?: string;
}): Promise<{ posts: PostSummary[]; total: number; page: number; total_pages: number }> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.sort_by) qs.set("sort_by", params.sort_by);

  const res = await authenticatedFetch(`${BASE}?${qs}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getPost(postId: number): Promise<PostDetail> {
  const res = await authenticatedFetch(`${BASE}/${postId}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createPost(payload: {
  title: string;
  content: string;
  category?: string;
}): Promise<PostDetail> {
  const res = await authenticatedFetch(BASE, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function uploadPostFile(postId: number, file: File): Promise<PostFile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authenticatedFetch(`${BASE}/${postId}/files`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function getPostFiles(postId: number): Promise<PostFile[]> {
  const res = await authenticatedFetch(`${BASE}/${postId}/files`);
  const data = await handleResponse<{ files: PostFile[] }>(res);
  return data.files;
}

export async function updatePost(
  postId: number,
  payload: { title?: string; content?: string; category?: string }
): Promise<PostDetail> {
  const res = await authenticatedFetch(`${BASE}/${postId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deletePost(postId: number): Promise<void> {
  const res = await authenticatedFetch(`${BASE}/${postId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}

export async function reactToPost(
  postId: number,
  reactionType: ReactionType
): Promise<{ action: "added" | "removed"; reaction_type: ReactionType }> {
  const res = await authenticatedFetch(`${BASE}/${postId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return handleResponse(res);
}

// ─── Hot Posts ────────────────────────────────────────────────────────────────

export async function getHotPosts(): Promise<{
  popular: PostSummary | null;
  most_recommended: PostSummary | null;
  most_commented: PostSummary | null;
  most_viewed: PostSummary | null;
  latest: PostSummary | null;
}> {
  const fetchTop1 = async (sort_by: string): Promise<PostSummary | null> => {
    const res = await authenticatedFetch(`${BASE}?sort_by=${sort_by}&page=1&page_size=1`, {
      headers: authHeaders(),
    });
    const data = await handleResponse<{ posts: PostSummary[] }>(res);
    return data.posts[0] ?? null;
  };

  const [popular, most_recommended, most_commented, most_viewed, latest] = await Promise.all([
    fetchTop1("hot"),
    fetchTop1("recommend"),
    fetchTop1("comments"),
    fetchTop1("views"),
    fetchTop1("newest"),
  ]);

  // 겹치는 게시물은 인기게시물(popular)에만 표시
  const usedIds = new Set<number>();
  if (popular) usedIds.add(popular.id);

  return {
    popular,
    most_recommended:
      most_recommended && !usedIds.has(most_recommended.id)
        ? (usedIds.add(most_recommended.id), most_recommended)
        : null,
    most_commented:
      most_commented && !usedIds.has(most_commented.id)
        ? (usedIds.add(most_commented.id), most_commented)
        : null,
    most_viewed:
      most_viewed && !usedIds.has(most_viewed.id)
        ? (usedIds.add(most_viewed.id), most_viewed)
        : null,
    latest:
      latest && !usedIds.has(latest.id) ? (usedIds.add(latest.id), latest) : null,
  };
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(
  postId: number,
  params?: { page?: number; page_size?: number }
): Promise<{ comments: CommentItem[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));

  const res = await authenticatedFetch(`${BASE}/${postId}/comments?${qs}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function createComment(
  postId: number,
  payload: {
    content: string;
    parent_comment_id?: number | null;
    is_anonymous?: boolean;
  }
): Promise<CommentItem> {
  const res = await authenticatedFetch(`${BASE}/${postId}/comments`, {
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
  const res = await authenticatedFetch(`${BASE}/${postId}/comments/${commentId}`, {
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
  const res = await authenticatedFetch(`${BASE}/${postId}/comments/${commentId}`, {
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
  const res = await authenticatedFetch(`${BASE}/${postId}/comments/${commentId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reaction_type: reactionType }),
  });
  return handleResponse(res);
}
