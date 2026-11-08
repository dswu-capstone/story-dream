import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo/logo";
import { getGuardian } from "../../api/auth";
import dreamy from "../../assets/dreamy-reading-book.svg";
import profile from "../../assets/profile.svg";
import "./childCompletePage.css";

export default function ChildCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { childId?: number; childName?: string } | null;
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getGuardian(controller.signal).then(guardian => {
      if (!controller.signal.aborted) setName(guardian.name);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  const showRecommendations = () => {
    const childId = state?.childId ?? localStorage.getItem("selectedChildId");
    const childName = state?.childName ?? localStorage.getItem("selectedChildName");
    if (childId && childName) {
      localStorage.setItem("selectedChildId", String(childId));
      localStorage.setItem("selectedChildName", childName);
    }
    navigate("/stories/recommend");
  };
  return <main className="child-complete">
    <div className="child-complete__scene">
    <div className="child-complete__scenery" aria-hidden="true">
      <i className="child-complete__hill" /><i className="child-complete__hill second" />
      <i className="child-complete__tree" /><i className="child-complete__tree second" />
    </div>
    <Logo />
    <div className="child-complete__guardian"><img src={profile} alt="" />{name ? `${name} 님` : error ? "보호자 정보 조회 실패" : "불러오는 중…"}</div>
    <section className="child-complete__content">
      <h1>아동 등록이 완료되었어요!</h1>
      <p>지금부터 아이에 맞는 동화를 추천해 드릴게요.</p>
      <img className="child-complete__dreamy" src={dreamy} alt="책을 읽는 드림이" />
      {!state?.childId && !localStorage.getItem("selectedChildId") && <p role="status">등록은 완료되었지만 아동 정보를 확인하지 못했어요. 추천 화면에서 아이를 선택해 주세요.</p>}
      <button className="child-complete__recommend" onClick={showRecommendations}>추천 동화 보러가기 <span aria-hidden="true">&gt;</span></button>
    </section>
    </div>
  </main>;
}
