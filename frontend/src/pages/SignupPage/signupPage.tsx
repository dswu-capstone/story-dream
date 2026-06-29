import "./signupPage.css";

import cloudLeft from "../../assets/cloud1.svg";
import cloudRight from "../../assets/cloud2.svg";
import loginId from "../../assets/loginId.svg";
import loginPassword from "../../assets/loginPassword.svg";
import signupName from "../../assets/signupName.svg";

function SignupPage() {
  return (
    <main className="signup-page">
      <div className="signup-container">
        <h1 className="signup-title">보호자 회원가입</h1>

        <form className="signup-form">
          <div className="signup-input-wrapper">
            <img src={signupName} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="text"
              placeholder="이름 입력"
            />
          </div>

          <div className="signup-input-wrapper">
            <img src={loginId} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="text"
              placeholder="아이디 입력"
            />
          </div>

          <div className="signup-input-wrapper">
            <img src={loginPassword} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="password"
              placeholder="비밀번호 입력"
            />
          </div>

          <div className="signup-input-wrapper">
            <img src={loginPassword} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="password"
              placeholder="비밀번호 확인"
            />
          </div>

          <button className="signup-button" type="button">
            회원가입
          </button>
        </form>
      </div>

      <img src={cloudLeft} alt="" className="signup-cloud signup-cloud-left" />
      <img src={cloudRight} alt="" className="signup-cloud signup-cloud-right" />
    </main>
  );
}

export default SignupPage;