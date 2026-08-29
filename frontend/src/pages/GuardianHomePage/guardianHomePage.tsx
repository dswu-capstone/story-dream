import { useNavigate } from "react-router-dom";

import Logo from "../../components/Logo/logo";
import profileIcon from "../../assets/profile.svg";
import readingReportIcon from "../../assets/readingReport.svg";
import "./guardianHomePage.css";

function GuardianHomePage() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("tokenType");
    navigate("/", { replace: true });
  };

  return (
    <main className="guardian-home-page">
      <Logo />

      <button
        type="button"
        className="guardian-home-page__logout"
        onClick={handleLogout}
        aria-label="보호자 계정에서 로그아웃"
      >
        로그아웃 <span aria-hidden="true">↪</span>
      </button>

      <section className="guardian-home-page__menus" aria-label="보호자 메뉴">
        <button
          type="button"
          className="guardian-home-page__card guardian-home-page__card--children"
          onClick={() => navigate("/guardian/children")}
          aria-label="아동 관리: 아이 등록과 수정, 초기 난이도 설정"
        >
          <img src={profileIcon} alt="" />
          <strong>아동 관리</strong>
          <span>아이 등록/수정, 초기 난이도 설정</span>
        </button>

        <button
          type="button"
          className="guardian-home-page__card guardian-home-page__card--report"
          onClick={() => navigate("/guardian/reports/select")}
          aria-label="독서 리포트: 독서 이력과 정답률 확인"
        >
          <img src={readingReportIcon} alt="" />
          <strong>독서 리포트</strong>
          <span>독서 이력, 정답률 확인</span>
        </button>
      </section>
    </main>
  );
}

export default GuardianHomePage;
