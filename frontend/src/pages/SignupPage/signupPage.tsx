import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./signupPage.css";

import cloudLeft from "../../assets/cloud1.svg";
import cloudRight from "../../assets/cloud2.svg";
import loginId from "../../assets/loginId.svg";
import loginPassword from "../../assets/loginPassword.svg";
import signupName from "../../assets/signupName.svg";

function SignupPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [loginIdValue, setLoginIdValue] = useState("");
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const handleSignup = async () => {
    setErrorMessage("");

    if (!name || !loginIdValue || !password || !passwordCheck) {
      setErrorMessage("모든 항목을 입력해주세요.");
      return;
    }

    if (password !== passwordCheck) {
      setErrorMessage("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId: loginIdValue,
          password,
          name,
        }),
      });

      const result = await response.json();

      if (response.status === 201 && result.success) {
        const goLogin = window.confirm(
          "회원가입이 완료되었습니다.\n바로 로그인 페이지로 이동하시겠습니까?"
        );

        if (goLogin) {
          navigate("/guardian/login");
        }

        return;
      }

      if (response.status === 409) {
        setErrorMessage("이미 사용 중인 아이디입니다.");
        return;
      }

      if (response.status === 400) {
        setErrorMessage(result.message || "입력값을 확인해주세요.");
        return;
      }

      setErrorMessage(result.message || "회원가입에 실패했습니다.");
    } catch (error) {
      console.error(error);
      setErrorMessage("서버와 연결할 수 없습니다.");
    }
  };

  return (
    <main className="signup-page">
      <div className="signup-container">
        <h1 className="signup-title">보호자 회원가입</h1>

        <form
          className="signup-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSignup();
          }}
        >
          <div className="signup-input-wrapper">
            <img src={signupName} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="text"
              placeholder="이름 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="signup-input-wrapper">
            <img src={loginId} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="text"
              placeholder="아이디 입력"
              value={loginIdValue}
              onChange={(e) => setLoginIdValue(e.target.value)}
            />
          </div>

          <div className="signup-input-wrapper">
            <img src={loginPassword} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="signup-input-wrapper">
            <img src={loginPassword} alt="" className="signup-input-icon" />
            <input
              className="signup-input"
              type="password"
              placeholder="비밀번호 확인"
              value={passwordCheck}
              onChange={(e) => setPasswordCheck(e.target.value)}
            />
          </div>

          {errorMessage && (
            <p className="signup-error-message">{errorMessage}</p>
          )}

          <button className="signup-button" type="submit">
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