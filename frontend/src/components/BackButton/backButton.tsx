import { useLocation, useNavigate } from "react-router-dom";
import "./backButton.css";

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/") return null;

  const goBack = () => {
    const historyIndex: unknown = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <button type="button" className="app-back-button" onClick={goBack}>
      <span aria-hidden="true">←</span> 뒤로가기
    </button>
  );
}
