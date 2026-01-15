import api from "./api";

export type AuthUser = { id: string; email: string; displayName?: string };

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  const { token, user } = res.data;
  if (token) localStorage.setItem("token", token);
  return res.data; 
}

export async function register(email: string, password: string, displayName?: string) {
  const res = await api.post("/auth/register", { email, password, displayName });
  const { token, user } = res.data;
  if (token) localStorage.setItem("token", token);
  return res.data; 
}

export function logout() {
  localStorage.removeItem("token");
}
