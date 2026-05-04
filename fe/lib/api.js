const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function createIdeaApi(payload) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(`${API_BASE_URL}/api/v1/ideas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  
    if (!res.ok) {
      throw new Error("아이디어 등록에 실패했습니다.");
    }
  
    return res.json();
  }
  
  export async function getProjectApi(projectId) {
    return {
      success: true,
      data: {
        id: projectId,
        title: "Devory 앱 개발",
        summary: "개발 프로젝트 협업자를 찾고 팀을 구성하는 플랫폼",
        description:
          "Devory는 아이디어 등록, 팀 매칭, 프로젝트 진행 관리, 회고 기능을 제공하는 개발 협업 플랫폼입니다.",
        status: "planning",
        difficulty: "beginner",
        progress_percent: 20,
        leader_id: 1,
        members: [
          { user_id: 1, role_in_project: "leader" },
          { user_id: 2, role_in_project: "frontend" },
        ],
      },
    };
  }
  
  export async function applyProjectApi(projectId, message) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `${API_BASE_URL}/api/v1/projects/${projectId}/applications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );
  
    if (!res.ok) {
      throw new Error("프로젝트 지원에 실패했습니다.");
    }
  
    return res.json();
  }

  export async function getChatRoomsApi(projectId) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  
    if (!res.ok) {
      throw new Error("채팅방 목록을 불러오지 못했습니다.");
    }
  
    return res.json();
  }
  
  export async function createChatRoomApi(projectId, name) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/projects/${projectId}/rooms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      }
    );
  
    if (!res.ok) {
      throw new Error("채팅방 생성에 실패했습니다.");
    }
  
    return res.json();
  }
  
  export async function getMessagesApi(roomId) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  
    if (!res.ok) {
      throw new Error("메시지를 불러오지 못했습니다.");
    }
  
    return res.json();
  }
  
  export async function sendMessageApi(roomId, message) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );
  
    if (!res.ok) {
      throw new Error("메시지 전송에 실패했습니다.");
    }
  
    return res.json();
  }

  export async function getMyProfileApi() {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(`${API_BASE_URL}/api/v1/users/me/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) {
      throw new Error("내 프로필을 불러오지 못했습니다.");
    }
  
    return res.json();
  }
  
  export async function getMyReputationApi() {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(`${API_BASE_URL}/api/v1/users/me/reputation`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) {
      throw new Error("신뢰도 정보를 불러오지 못했습니다.");
    }
  
    return res.json();
  }
  
  export async function getUserStatsApi(userId) {
    const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/stats`);
  
    if (!res.ok) {
      throw new Error("사용자 통계를 불러오지 못했습니다.");
    }
  
    return res.json();
  }
  
  export async function getUserProjectsApi(userId) {
    const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/projects`);
  
    if (!res.ok) {
      throw new Error("사용자 프로젝트 이력을 불러오지 못했습니다.");
    }
  
    return res.json();
  }




  export async function getMyReceivedReviewsApi() {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/users/me/reviews", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) {
      throw new Error("받은 리뷰 목록을 불러오지 못했습니다.");
    }
  
    return res.json();
  }

  export async function requestAdoptionApi(projectId, message) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch(
      `http://localhost:8000/api/v1/adoptions/projects/${projectId}/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      }
    );
  
    if (!res.ok) {
      throw new Error("이어받기 요청에 실패했습니다.");
    }
  
    return res.json();
  }

  export async function updateMyProfileApi(payload) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/users/me/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  
    if (!res.ok) {
      throw new Error("프로필 수정 실패");
    }
  
    return res.json();
  }
  
  export async function addMySkillApi(name, proficiency = 3) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/users/me/skills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, proficiency }),
    });
  
    if (!res.ok) {
      throw new Error("기술 스택 추가 실패");
    }
  
    return res.json();
  }
  
  export async function addMyInterestApi(name, interestLevel = 3) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/users/me/interests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        interest_level: interestLevel,
      }),
    });
  
    if (!res.ok) {
      throw new Error("관심 분야 추가 실패");
    }
  
    return res.json();
  }

  export async function signupApi(email, nickname, password) {
    const res = await fetch("http://localhost:8000/api/v1/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        nickname,
        password,
      }),
    });
  
    if (!res.ok) {
      throw new Error("회원가입에 실패했습니다.");
    }
  
    return res.json();
  }
  
  export async function loginApi(loginId, password) {
    const res = await fetch("http://localhost:8000/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login_id: loginId,
        password,
      }),
    });
  
    if (!res.ok) {
      throw new Error("로그인에 실패했습니다.");
    }
  
    return res.json();
  }
  
  export async function getMyAuthInfoApi() {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) {
      throw new Error("내 인증 정보를 불러오지 못했습니다.");
    }
  
    return res.json();
  }