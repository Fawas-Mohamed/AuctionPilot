import axios from "axios";
import { API_URL } from "./config";

const api = axios.create({ baseURL: API_URL, timeout: 120_000 });
api.interceptors.request.use(config => {
    const token = localStorage.getItem("token");
    if (token) config.headers.set("Authorization", "Bearer " + token);
    return config;
});
api.interceptors.response.use(response => response, async error => {
    const config = error.config;
    if (error.response?.status === 401 && localStorage.getItem("token")) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        window.dispatchEvent(new Event("auctionpilot:unauthorized"));
    }
    if (config?.method === "get" && !config.coldStartRetried &&
        (!error.response || [502, 503, 504].includes(error.response.status))) {
        config.coldStartRetried = true;
        await new Promise(resolve => setTimeout(resolve, 2000));
        return api.request(config);
    }
    return Promise.reject(error);
});
export default api;
