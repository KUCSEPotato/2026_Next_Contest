import { authenticatedFetch, getRefreshToken, getToken, getApiBaseUrl } from "./auth";

const API_BASE_URL = getApiBaseUrl();

export function getImageUrl(url) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
}

function authHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

async function handleResponse(res, errorMessage) {
  if (!res.ok) {
    let detail = "";

    try {
      const data = await res.json();
      detail = data?.detail || data?.message || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => "");
    }

    throw new Error(detail ? `${errorMessage}: ${detail}` : errorMessage);
  }

  return res.json();
}

/* =========================
   Auth
========================= */

export async function signupApi(email, nickname, password) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email,
      nickname,
      password,
    }),
  });

  return handleResponse(res, "회원가입에 실패했습니다.");
}

export async function loginApi(loginId, password) {
    const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        login_id: loginId,
        password,
      }),
    });
  
    return handleResponse(res, "로그인에 실패했습니다.");
  }

export async function findLoginIdApi(email) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/login-id/find`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });

  return handleResponse(res, "아이디 찾기에 실패했습니다.");
}

export async function requestPasswordResetApi(email) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/password/forgot`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });

  return handleResponse(res, "비밀번호 재설정 요청에 실패했습니다.");
}

export async function resetPasswordApi(token, newPassword) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/auth/password/reset`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  return handleResponse(res, "비밀번호 재설정에 실패했습니다.");
}

/* =========================
   Ideas
========================= */

export async function createIdeaApi(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "아이디어 등록에 실패했습니다.");
}

export async function getIdeasApi(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", params.page);
  if (params.size) query.set("size", params.size);
  if (params.difficulty) query.set("difficulty", params.difficulty);
  if (params.discarded !== undefined) query.set("discarded", params.discarded);

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/ideas?${queryString}`
    : `${API_BASE_URL}/api/v1/ideas`;

  const res = await authenticatedFetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 목록을 불러오지 못했습니다.");
}

export async function getIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 정보를 불러오지 못했습니다.");
}

export async function updateIdeaApi(ideaId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "아이디어 수정에 실패했습니다.");
}

export async function deleteIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 삭제에 실패했습니다.");
}

export async function bookmarkIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/bookmark`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 북마크에 실패했습니다.");
}

export async function unbookmarkIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/bookmark`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 북마크 해제에 실패했습니다.");
}

export async function likeIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/like`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 좋아요에 실패했습니다.");
}

export async function unlikeIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/like`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 좋아요 취소에 실패했습니다.");
}

export async function convertIdeaToProjectApi(ideaId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/ideas/${ideaId}/convert-to-project`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "아이디어를 프로젝트로 전환하지 못했습니다.");
}

export async function pickupIdeaApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/pickup`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어를 건져오지 못했습니다.");
}

/* =========================
   Projects
========================= */

export async function createProjectApi(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 생성에 실패했습니다.");
}

export async function getProjectsApi(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", params.page);
  if (params.size) query.set("size", params.size);
  if (params.status) query.set("status", params.status);

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/projects?${queryString}`
    : `${API_BASE_URL}/api/v1/projects`;

  const res = await authenticatedFetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 목록을 불러오지 못했습니다.");
}

export async function getProjectApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 정보를 불러오지 못했습니다.");
}

export async function getProjectStatusApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/status-check`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 상태를 확인하지 못했습니다.");
}

export async function getRecommendedProjectsApi(payload = {}, limit = 20) {
  const query = new URLSearchParams();
  query.set("limit", limit);

  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/recommendations/projects?${query.toString()}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "추천 프로젝트를 불러오지 못했습니다.");
}

export async function updateProjectApi(projectId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 수정에 실패했습니다.");
}

export async function deleteProjectApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 삭제에 실패했습니다.");
}

export async function applyProjectApi(projectId, message) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/applications`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    }
  );

  return handleResponse(res, "프로젝트 지원에 실패했습니다.");
}

export async function getProjectApplicationsApi(projectId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/applications`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "지원자 목록을 불러오지 못했습니다.");
}

export async function decideProjectApplicationApi(
  projectId,
  applicationId,
  payload
) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/applications/${applicationId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "지원 상태 변경에 실패했습니다.");
}

export async function updateProjectStatusApi(projectId, status) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });

  return handleResponse(res, "프로젝트 상태 변경에 실패했습니다.");
}

export async function getProjectProgressApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/progress`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 진행률을 불러오지 못했습니다.");
}

export async function revertProjectToIdeaApi(projectId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/revert-to-idea`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "프로젝트를 아이디어로 되돌리지 못했습니다.");
}

/* =========================
   Project members / invite
========================= */

export async function inviteProjectMemberApi(projectId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/invite`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "멤버 초대에 실패했습니다.");
}

export async function acceptProjectInviteApi(projectId, inviteId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/invite/${inviteId}/accept`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "초대 수락에 실패했습니다.");
}

export async function rejectProjectInviteApi(projectId, inviteId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/invite/${inviteId}/reject`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "초대 거절에 실패했습니다.");
}

export async function addProjectMemberApi(projectId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 멤버 추가에 실패했습니다.");
}

export async function removeProjectMemberApi(projectId, memberId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/members/${memberId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "프로젝트 멤버 제거에 실패했습니다.");
}

/* =========================
   Todos
========================= */

export async function createTodoApi(projectId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Todo 생성에 실패했습니다.");
}

export async function getTodosApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "Todo 목록을 불러오지 못했습니다.");
}

export async function getTodoStateApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos/state`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "Todo 확정 상태를 불러오지 못했습니다.");
}

export async function confirmTodosApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "Todo 확정에 실패했습니다.");
}

export async function updateTodoApi(projectId, todoId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/todos/${todoId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "Todo 수정에 실패했습니다.");
}

export async function toggleTodoDoneApi(projectId, todoId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/todos/${todoId}/done`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "Todo 완료 상태 변경에 실패했습니다.");
}

export async function generateAITodosApi(projectId, payload = {}) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/todos/ai-generate`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "AI Todo 생성에 실패했습니다.");
}

export async function deleteTodoApi(projectId, todoId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/todos/${todoId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "Todo 삭제에 실패했습니다.");
}

/* =========================
   Milestones
========================= */

export async function createMilestoneApi(projectId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/milestones`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "마일스톤 생성에 실패했습니다.");
}

export async function updateMilestoneApi(projectId, milestoneId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/milestones/${milestoneId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "마일스톤 수정에 실패했습니다.");
}

/* =========================
   Recruitments
========================= */

export async function createRecruitmentApi(projectId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/recruitments`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "재모집 생성에 실패했습니다.");
}

export async function updateRecruitmentApi(projectId, recruitmentId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/recruitments/${recruitmentId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "재모집 수정에 실패했습니다.");
}

/* =========================
   Reviews
========================= */

export async function createProjectReviewApi(projectId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/reviews`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "리뷰 작성에 실패했습니다.");
}

export async function getProjectReviewsApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/reviews`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 리뷰 목록을 불러오지 못했습니다.");
}

export async function createProjectRetrospectiveApi(projectId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/retrospectives`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "회고 작성에 실패했습니다.");
}

export async function getProjectRetrospectivesApi(projectId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/retrospectives`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "회고 목록을 불러오지 못했습니다.");
}

export async function getProjectRetrospectiveApi(projectId, retrospectiveId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/retrospectives/${retrospectiveId}`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "회고 상세를 불러오지 못했습니다.");
}

export async function updateProjectRetrospectiveApi(projectId, retrospectiveId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/retrospectives/${retrospectiveId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "회고 수정에 실패했습니다.");
}

export async function refineProjectMemoirApi(projectId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/memoir/ai-refine`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "AI 회고록 생성에 실패했습니다.");
}

/* =========================
   Chat
========================= */

export async function getChatRoomsApi(projectId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "채팅방 목록을 불러오지 못했습니다.");
}

export async function createChatRoomApi(projectId, payload) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "채팅방 생성에 실패했습니다.");
}

export async function getMessagesApi(roomId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "메시지를 불러오지 못했습니다.");
}

export async function sendMessageApi(roomId, message) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });

  return handleResponse(res, "메시지 전송에 실패했습니다.");
}

/* =========================
   My Page / Users
========================= */

export async function getMyProfileApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 프로필을 불러오지 못했습니다.");
}

export async function getMyReputationApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/reputation`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "신뢰도 정보를 불러오지 못했습니다.");
}

export async function getUserReputationApi(userId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/${userId}/reputation`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 신뢰도 정보를 불러오지 못했습니다.");
}

export async function getUserStatsApi(userId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/${userId}/stats`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 통계를 불러오지 못했습니다.");
}

export async function getUserProjectsApi(userId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/${userId}/projects`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 프로젝트 이력을 불러오지 못했습니다.");
}

export async function getMyReceivedReviewsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/reviews`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "받은 리뷰 목록을 불러오지 못했습니다.");
}

export async function updateMyProfileApi(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로필 수정 실패");
}

export async function withdrawMyAccountApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: getRefreshToken() }),
  });

  return handleResponse(res, "회원 탈퇴에 실패했습니다.");
}

export async function addMySkillApi(name, proficiency = 3) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/skills`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, proficiency }),
  });

  return handleResponse(res, "기술 스택 추가 실패");
}

export async function addMyInterestApi(name, interestLevel = 3) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/interests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      interest_level: interestLevel,
    }),
  });

  return handleResponse(res, "관심 분야 추가 실패");
}

export async function uploadMyAvatarApi(file) {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);

  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/avatar`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  return handleResponse(res, "프로필 이미지 업로드에 실패했습니다.");
}

/* =========================
   Adoption
========================= */

export async function requestAdoptionApi(projectId, message) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/adoptions/projects/${projectId}/request`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    }
  );

  return handleResponse(res, "이어받기 요청에 실패했습니다.");
}

/* =========================
   Compatibility aliases
========================= */

export const applyIdeaApi = applyProjectApi;

export async function getNotificationsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/notifications`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "알림 목록을 불러오지 못했습니다.");
}

export async function readNotificationApi(notificationId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "알림 읽음 처리에 실패했습니다.");
}

export async function readAllNotificationsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders(),
  });

  return handleResponse(res, "알림 모두 읽음 처리에 실패했습니다.");
}

/* =========================
   Coins
========================= */

export async function getMyCoinBalanceApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/coins/me`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "코인 잔액을 불러오지 못했습니다.");
}

export async function getCoinPackagesApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/coins/packages`, {
    cache: "no-store",
  });

  return handleResponse(res, "코인 패키지를 불러오지 못했습니다.");
}

export async function createCoinPurchaseRequestApi(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/coins/purchase-requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "코인 구매 요청에 실패했습니다.");
}

export async function getMyCoinPurchaseRequestsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/coins/purchase-requests/me`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "코인 구매 요청 목록을 불러오지 못했습니다.");
}

/* =========================
   Admin
========================= */

export async function getAdminOverviewApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/overview`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "운영 요약을 불러오지 못했습니다.");
}

export async function getAdminUsersApi(params = {}) {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.role) query.set("role", params.role);
  if (params.is_active !== undefined && params.is_active !== "") {
    query.set("is_active", String(params.is_active));
  }

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/admin/users?${queryString}`
    : `${API_BASE_URL}/api/v1/admin/users`;

  const res = await authenticatedFetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 목록을 불러오지 못했습니다.");
}

export async function grantAdminUserCoinsApi(userId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/coins`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "코인 지급에 실패했습니다.");
}

export async function updateAdminUserStatusApi(userId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "사용자 상태 변경에 실패했습니다.");
}

export async function getAdminProjectsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/projects`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 목록을 불러오지 못했습니다.");
}

export async function getAdminReportsApi(params = {}) {
  const query = new URLSearchParams();

  if (params.scope) query.set("scope", params.scope);

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/admin/reports?${queryString}`
    : `${API_BASE_URL}/api/v1/admin/reports`;

  const res = await authenticatedFetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "신고 목록을 불러오지 못했습니다.");
}

export async function updateAdminReportApi(reportId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/reports/${reportId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "신고 처리에 실패했습니다.");
}

export async function getAdminPaymentsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/payments`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "결제 이벤트 목록을 불러오지 못했습니다.");
}

export async function updateAdminPaymentApi(eventId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/payments/${eventId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "결제 이벤트 처리에 실패했습니다.");
}

export async function getAdminCoinPurchaseRequestsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/coin-purchase-requests`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "코인 구매 요청 목록을 불러오지 못했습니다.");
}

export async function updateAdminCoinPurchaseRequestApi(requestId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/coin-purchase-requests/${requestId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "코인 구매 요청 처리에 실패했습니다.");
}

export async function createAdminNoticeApi(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/notices`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "공지 작성에 실패했습니다.");
}

export async function revokeAdminUserCoinsApi(userId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/coins/revoke`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "코인 환수에 실패했습니다.");
}

export async function getAdminMyPostsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/posts/mine`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 공지/이벤트 목록을 불러오지 못했습니다.");
}

export async function getAdminPostsApi(params = {}) {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.include_deleted !== undefined) {
    query.set("include_deleted", String(params.include_deleted));
  }

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/admin/posts?${queryString}`
    : `${API_BASE_URL}/api/v1/admin/posts`;

  const res = await authenticatedFetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "게시글 목록을 불러오지 못했습니다.");
}

export async function adminUpdatePostApi(postId, payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/posts/${postId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "게시물 수정에 실패했습니다.");
}

export async function adminDeletePostApi(postId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "게시물 삭제에 실패했습니다.");
}

export async function adminTakedownPostApi(postId, payload = {}) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/posts/${postId}/takedown`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "게시물 강제 내리기에 실패했습니다.");
}

export async function adminTakedownIdeaApi(ideaId, payload = {}) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/ideas/${ideaId}/takedown`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "아이디어 강제 내리기에 실패했습니다.");
}

export async function adminTakedownProjectApi(projectId, payload = {}) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/admin/projects/${projectId}/takedown`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 강제 내리기에 실패했습니다.");
}

export async function getMyChatRoomsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/chats/my/rooms`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 채팅방 목록을 불러오지 못했습니다.");
}

export async function completeTeamApi(projectId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/projects/${projectId}/complete-team`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "팀 결성에 실패했습니다.");
}

export async function getIdeaDetailApi(ideaId) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    headers: authHeaders(),
  });
  return handleResponse(res, "아이디어 정보를 불러오지 못했습니다.");
}

export async function getMyProjectsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/projects`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 프로젝트 목록을 불러오지 못했습니다.");
}

export async function getMyApplicationsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/v1/users/me/applications`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 지원 목록을 불러오지 못했습니다.");
}

export async function discardProjectToWellApi(projectId) {
  return revertProjectToIdeaApi(projectId);
}

export async function getUserProfileApi(userId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/users/${userId}/profile`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "사용자 프로필 조회에 실패했습니다.");
}

export async function getUserReceivedReviewsApi(userId) {
  const res = await authenticatedFetch(
    `${API_BASE_URL}/api/v1/users/${userId}/reviews`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "사용자 리뷰 조회에 실패했습니다.");
}
