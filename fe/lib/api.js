export async function createIdeaApi(payload) {
    const token = localStorage.getItem("access_token");
  
    const res = await fetch("http://localhost:8000/api/v1/ideas", {
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
      `http://localhost:8000/api/v1/projects/${projectId}/applications`,
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