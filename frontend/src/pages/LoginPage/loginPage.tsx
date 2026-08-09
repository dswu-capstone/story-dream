import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./loginPage.css";

import cloudLeft from "../../assets/cloud1.svg";
import cloudRight from "../../assets/cloud2.svg";
import loginId from "../../assets/loginId.svg";
import loginPassword from "../../assets/loginPassword.svg";
import googleLogin from "../../assets/googlLogin.svg";
import kakaoLogin from "../../assets/kakaoLogin.svg";

function LoginPage() {
  const navigate = useNavigate();

  const [loginIdValue, setLoginIdValue] = useState("")
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async () => {
    setErrorMessage("");

    if (!loginIdValue || !password) {
      setErrorMessage("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId: loginIdValue,
          password: password,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        setErrorMessage("회원이 아니거나 비밀번호가 불일치합니다.");
        return;
      }

      localStorage.setItem("accessToken", result.data.accessToken);
      localStorage.setItem("tokenType", result.data.tokenType);

      window.confirm("로그인 성공");

      navigate("/");
    } catch (error) {
      setErrorMessage("서버와 연결할 수 없습니다.");
    }
  };

  return (
    <main className="login-page">
      <div className="login-container">
        <h1 className="login-title">보호자 로그인</h1>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div className="login-input-wrapper">
            <img src={loginId} alt="" className="login-input-icon" />
            <input
              className="login-input"
              type="text"
              placeholder="아이디 입력"
              value={loginIdValue}
              onChange={(e) => setLoginIdValue(e.target.value)}
            />
          </div>

          <div className="login-input-wrapper">
            <img src={loginPassword} alt="" className="login-input-icon" />
            <input
              className="login-input"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {errorMessage && <p className="login-error-message">{errorMessage}</p>}

          <button className="login-button" type="submit">
            로그인
          </button>
        </form>

        <p className="find-account">아이디/비밀번호 찾기</p>

        <div className="social-login">
          <button type="button" className="social-login-button">
            <img src={kakaoLogin} alt="카카오 로그인" />
          </button>

          <button type="button" className="social-login-button">
            <img src={googleLogin} alt="Google 로그인" />
          </button>
        </div>

        <div className="signup-area">
          <p className="signup-text">회원이 아니신가요?</p>
          <p className="signup-link" onClick={() => navigate("/guardian/signup")}>
            회원가입하기
          </p>
        </div>
      </div>

      <img src={cloudLeft} alt="" className="login-cloud login-cloud-left" />
      <img src={cloudRight} alt="" className="login-cloud login-cloud-right" />
    </main>
  );
}

export default LoginPage;