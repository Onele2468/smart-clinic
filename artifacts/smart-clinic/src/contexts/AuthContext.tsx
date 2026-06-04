// @refresh reset
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe, useGetMeClinic, setAuthTokenGetter, getGetMeQueryKey, getGetMeClinicQueryKey } from "@workspace/api-client-react";
import type { User, ClinicMembership } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null | undefined;
  clinicMembership: ClinicMembership | null | undefined;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refetchClinic: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Initialize custom fetch token getter
setAuthTokenGetter(() => localStorage.getItem("token"));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, refetch: refetchUser } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const { data: clinicMembership, isLoading: isClinicLoading, refetch: refetchClinicMembership } = useGetMeClinic({
    query: {
      enabled: !!user,
      retry: false,
      queryKey: getGetMeClinicQueryKey(),
    }
  });

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    refetchUser();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setLocation("/login");
  };

  const refetchClinic = () => {
    refetchClinicMembership();
  };

  const isLoading = (!!token && isUserLoading) || (!!user && isClinicLoading);

  return (
    <AuthContext.Provider value={{ user, clinicMembership, isLoading, login, logout, refetchClinic }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
