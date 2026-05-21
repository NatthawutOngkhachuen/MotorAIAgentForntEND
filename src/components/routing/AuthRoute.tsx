import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { getStoredAccessToken } from "@/services/authStorage";

function hasAccessToken() {
  return Boolean(getStoredAccessToken());
}

export function HomeRedirect() {
  return <Navigate to={hasAccessToken() ? "/chat" : "/login"} replace />;
}

export function RequireAuth({ children }: { children: ReactElement }) {
  if (!hasAccessToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
