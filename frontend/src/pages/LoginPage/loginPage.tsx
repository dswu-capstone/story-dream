import "./LoginPage.css";

import cloudLeft from "../../assets/cloud1.svg";
import cloudRight from "../../assets/cloud2.svg";
import loginId from "../../assets/loginId.svg";
import loginPassword from "../../assets/loginPassword.svg";
import googleLogin from "../../assets/googlLogin.svg";
import kakaoLogin from "../../assets/kakaoLogin.svg";

function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-container">
        <h1 className="login-title">보호자 로그인</h1>

        <form className="login-form">
          <div className="login-input-wrapper">
            <img src={loginId} alt="" className="login-input-icon" />
            <input className="login-input" type="text" placeholder="아이디 입력"></input>
          </div>

          <div className="login-input-wrapper">
            <img src={loginPassword} alt="" className="login-input-icon" />
            <input className="login-input" type="password" placeholder="비밀번호 입력"></input>
          </div>

          <button className="login-button" type="button">로그인</button>
        </form>

        <p className="find-account">아이디/비밀번호 찾기</p>

        <div className="social-login">
          <button type="button" className="social-login-button">
            <img src={kakaoLogin} alt="카카오 로그인"></img>
          </button>

          <button type="button" className="social-login-button">
            <img src={googleLogin} alt="Google 로그인"></img>
          </button>
        </div>

        <div className="signup-area">
          <p className="signup-text">회원이 아니신가요?</p>
          <p className="signup-link">회원가입하기</p>
        </div>
      </div>


      <img src={cloudLeft} alt="" className="login-cloud login-cloud-left" />
      <img src={cloudRight} alt="" className="login-cloud login-cloud-right" />
    </main>
  );
}

export default LoginPage;