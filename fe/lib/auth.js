export function saveToken(token) {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid access token");
    }
  
    localStorage.setItem("access_token", token);
  }
  
  export function getToken() {
    return localStorage.getItem("access_token");
  }
  
  export function removeToken() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
  }