import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./childCreatePage.css";

function ChildCreatePage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [defaultLevel, setDefaultLevel] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const handleSubmit = async () => {
    const accessToken = localStorage.getItem("accessToken");

    const response = await fetch("/api/children", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name,
        birthDate,
        defaultLevel,
        interest: interests,
      }),
    });

    if (!response.ok) {
      alert("아동 등록에 실패했습니다.");
      return;
    }

    navigate("/guardian/children");
  };

  return (
    <main className="child-create-page">
      <section className="child-create-page__panel">
        {/* 뒤로가기 */}
        <button
          type="button"
          className="child-create-page__back-button"
          onClick={() => navigate(-1)}
          aria-label="이전 페이지"
        >
          &lt;
        </button>

        {/* 제목 */}
        <h1 className="child-create-page__title">
          아동 상세 설정
        </h1>

        <div className="child-create-page__form">
          {/* 이름 */}
          <label className="child-create-page__row">
            <span className="child-create-page__label">
              이름
            </span>

            <input
              className="child-create-page__input"
              type="text"
              value={name}
              placeholder="이름을 입력해주세요"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {/* 출생일 */}
          <label className="child-create-page__row">
            <span className="child-create-page__label">
              출생일
            </span>

            <input
              className="child-create-page__input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          {/* 초기 난이도 */}
          <div className="child-create-page__row">
            <span className="child-create-page__label">
              초기 난이도
            </span>

            <div className="child-create-page__levels">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={
                    defaultLevel === level
                      ? "child-create-page__level child-create-page__level--active"
                      : "child-create-page__level"
                  }
                  onClick={() => setDefaultLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* 관심 분야 */}
          <label
            className="child-create-page__row child-create-page__interest-row"
          >
            <span className="child-create-page__label">
              관심 분야
            </span>

            <textarea
              className="child-create-page__interest-input"
              value={interests.join(", ")}
              placeholder="예: 공룡과 우주를 좋아하고 모험 이야기를 좋아해요"
              onChange={(e) =>
                setInterests(e.target.value.trim() ? [e.target.value] : [])
              }
              rows={2}
            />
          </label>

        </div>

        {/* 등록 버튼 */}
        <button
          type="button"
          className="child-create-page__submit-button"
          onClick={handleSubmit}
        >
          등록하기
        </button>
      </section>

    </main>
  );
}

export default ChildCreatePage;
