const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
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

export async function signupApi(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "회원가입에 실패했습니다.");
}

export async function loginApi(loginId, password) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        login_id: loginId,
        password,
      }),
    });
  
    return handleResponse(res, "로그인에 실패했습니다.");
  }

/* =========================
   Ideas
========================= */

export async function createIdeaApi(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas`, {
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

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/v1/ideas?${queryString}`
    : `${API_BASE_URL}/api/v1/ideas`;

  const res = await fetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 목록을 불러오지 못했습니다.");
}

export async function getIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 정보를 불러오지 못했습니다.");
}

export async function updateIdeaApi(ideaId, payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "아이디어 수정에 실패했습니다.");
}

export async function deleteIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 삭제에 실패했습니다.");
}

export async function bookmarkIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/bookmark`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 북마크에 실패했습니다.");
}

export async function unbookmarkIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/bookmark`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 북마크 해제에 실패했습니다.");
}

export async function likeIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/like`, {
    method: "POST",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 좋아요에 실패했습니다.");
}

export async function unlikeIdeaApi(ideaId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas/${ideaId}/like`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "아이디어 좋아요 취소에 실패했습니다.");
}

export async function convertIdeaToProjectApi(ideaId, payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/ideas/${ideaId}/convert-to-project`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(res, "아이디어를 프로젝트로 전환하지 못했습니다.");
}

/* =========================
   Projects
========================= */

export async function createProjectApi(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects`, {
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

  const res = await fetch(url, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 목록을 불러오지 못했습니다.");
}

export async function getProjectApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 정보를 불러오지 못했습니다.");
}

export async function updateProjectApi(projectId, payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 수정에 실패했습니다.");
}

export async function deleteProjectApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 삭제에 실패했습니다.");
}

export async function applyProjectApi(projectId, message) {
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });

  return handleResponse(res, "프로젝트 상태 변경에 실패했습니다.");
}

export async function getProjectProgressApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/progress`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 진행률을 불러오지 못했습니다.");
}

export async function revertProjectToIdeaApi(projectId) {
  const res = await fetch(
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
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/invite`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "멤버 초대에 실패했습니다.");
}

export async function acceptProjectInviteApi(projectId, inviteId) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/invite/${inviteId}/accept`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "초대 수락에 실패했습니다.");
}

export async function rejectProjectInviteApi(projectId, inviteId) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/invite/${inviteId}/reject`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "초대 거절에 실패했습니다.");
}

export async function addProjectMemberApi(projectId, payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로젝트 멤버 추가에 실패했습니다.");
}

export async function removeProjectMemberApi(projectId, memberId) {
  const res = await fetch(
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
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Todo 생성에 실패했습니다.");
}

export async function getTodosApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/todos`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "Todo 목록을 불러오지 못했습니다.");
}

export async function updateTodoApi(projectId, todoId, payload) {
  const res = await fetch(
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
  const res = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/todos/${todoId}/done`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "Todo 완료 상태 변경에 실패했습니다.");
}

export async function deleteTodoApi(projectId, todoId) {
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/reviews`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "리뷰 작성에 실패했습니다.");
}

export async function getProjectReviewsApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/reviews`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 리뷰 목록을 불러오지 못했습니다.");
}

/* =========================
   Chat
========================= */

export async function getChatRoomsApi(projectId) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
    {
      headers: authHeaders(),
    }
  );

  return handleResponse(res, "채팅방 목록을 불러오지 못했습니다.");
}

export async function createChatRoomApi(projectId, name) {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    }
  );

  return handleResponse(res, "채팅방 생성에 실패했습니다.");
}

export async function getMessagesApi(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "메시지를 불러오지 못했습니다.");
}

export async function sendMessageApi(roomId, message) {
  const res = await fetch(`${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`, {
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
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "내 프로필을 불러오지 못했습니다.");
}

export async function getMyReputationApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/reputation`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "신뢰도 정보를 불러오지 못했습니다.");
}

export async function getUserStatsApi(userId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/stats`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 통계를 불러오지 못했습니다.");
}

export async function getUserProjectsApi(userId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/projects`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "사용자 프로젝트 이력을 불러오지 못했습니다.");
}

export async function getMyReceivedReviewsApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/reviews`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "받은 리뷰 목록을 불러오지 못했습니다.");
}

export async function updateMyProfileApi(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "프로필 수정 실패");
}

export async function addMySkillApi(name, proficiency = 3) {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/skills`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, proficiency }),
  });

  return handleResponse(res, "기술 스택 추가 실패");
}

export async function addMyInterestApi(name, interestLevel = 3) {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/interests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      interest_level: interestLevel,
    }),
  });

  return handleResponse(res, "관심 분야 추가 실패");
}

/* =========================
   Adoption
========================= */

export async function requestAdoptionApi(projectId, message) {
  const res = await fetch(
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
