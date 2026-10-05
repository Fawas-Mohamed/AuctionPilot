import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import * as authApi from "@/lib/auth";

type User = {
  id: string;
  email: string;
  displayName?: string;
  roles?: string[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  register:(email: string, password: string, displayName:string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (error: any) {
      if (error.response?.status === 401) localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
    const expired = () => { setUser(null); };
    window.addEventListener("auctionpilot:unauthorized", expired);
    return () => window.removeEventListener("auctionpilot:unauthorized", expired);
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    setUser(user); 
  };

  const register = async(email: string, password: string, displayName: string) =>{
    const {token, user} = await authApi.register(email, password, displayName);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.dispatchEvent(new Event("auctionpilot:unauthorized"));
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, register }}>
      {children}
    </AuthContext.Provider>
  );
};
