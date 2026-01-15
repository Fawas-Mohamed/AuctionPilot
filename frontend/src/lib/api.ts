import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:62628/api";
const api = axios.create({baseURL,});

api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
}, (error) => Promise.reject(error));

export default api;

