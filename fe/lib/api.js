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

export async function createIdeaApi(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ideas`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "아이디어 등록에 실패했습니다.");
}

export async function getProjectApi(projectId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    headers: authHeaders(),
  });

  return handleResponse(res, "프로젝트 정보를 불러오지 못했습니다.");
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

export async function signupApi(payload) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  
    return handleResponse(res, "회원가입에 실패했습니다.");
  }

  export async function loginApi(payload) {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  
    return handleResponse(res, "로그인에 실패했습니다.");
  }