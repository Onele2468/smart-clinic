// @refresh reset
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

setAuthTokenGetter(() => localStorage.getItem("token"));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("portal_user");
    if (!raw) return null;
    try { return JSON.parse(raw) as User; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("portal_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("portal_user");
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
