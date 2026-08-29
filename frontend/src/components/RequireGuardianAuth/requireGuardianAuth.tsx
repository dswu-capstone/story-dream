import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

function RequireGuardianAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!localStorage.getItem("accessToken")) return <Navigate to="/guardian/login" replace state={{ redirectTo: `${location.pathname}${location.search}` }} />;
  return children;
}

export default RequireGuardianAuth;
