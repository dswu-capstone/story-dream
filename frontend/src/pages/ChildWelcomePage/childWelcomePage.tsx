import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo/logo";
import character from "../../assets/character.svg";
import profile from "../../assets/profile.svg";
import { getGuardian } from "../../api/auth";
import "./childWelcomePage.css";

export default function ChildWelcomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [jump, setJump] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getGuardian(controller.signal).then(guardian => {
      if (!controller.signal.aborted) setName(guardian.name);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  return <main className="child-welcome">
    <div className="welcome-scenery" aria-hidden="true">
      {[0,1,2,3].map(i => <span key={i} className={`welcome-cloud cloud-${i}`} />)}
      {[0,1,2,3,4,5].map(i => <span key={i} className={`welcome-star star-${i}`}>✦</span>)}
      <div className="welcome-hill" /><div className="welcome-hill second" />
      <span className="welcome-flower">✿</span><span className="welcome-flower second">✿</span>
    </div>
    <Logo />
    <div className="welcome-guardian"><img src={profile} alt="" />{name ? `${name} 님` : error ? <button onClick={() => { setError(false); setAttempt(a => a + 1); }}>이름 다시 불러오기</button> : "불러오는 중…"}</div>
    <section className="welcome-content">
      <h1>우리 아이의<br />독서 여정을 시작해요!</h1>
      <p>아이 정보를 등록하고 맞춤 동화를 추천받을 수 있어요.</p>
      <button type="button" className={`welcome-dreamy${jump ? " jumping" : ""}`} aria-label="드림이와 인사하기" onClick={() => setJump(true)} onAnimationEnd={() => setJump(false)}>
        <img src={character} alt="드림이" />
        {jump && <span className="welcome-sparkles" aria-hidden="true">✦ ˚ ✧</span>}
      </button>
      <button className="welcome-register" onClick={() => navigate("/guardian/children/new")}>아동 등록하러 가기 <span aria-hidden="true">&gt;</span></button>
    </section>
  </main>;
}
