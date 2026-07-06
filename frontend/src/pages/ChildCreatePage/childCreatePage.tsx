import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./childCreatePage.css";

const interestOptions = [
  "공주",
  "공룡",
  "자동차",
  "동물",
  "우주",
  "로봇",
  "마법",
  "모험",
];

function ChildCreatePage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [defaultLevel, setDefaultLevel] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [useParentVoice, setUseParentVoice] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest],
    );
  };

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
        useParentVoice,
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
          <button
            type="button"
            className="child-create-page__row child-create-page__interest-row"
            onClick={() => setIsModalOpen(true)}
          >
            <span className="child-create-page__label">
              관심 분야
            </span>

            <span
              className={
                interests.length > 0
                  ? "child-create-page__interest-value"
                  : "child-create-page__interest-value child-create-page__interest-value--empty"
              }
            >
              {interests.length > 0
                ? interests.join(", ")
                : "눌러서 관심 분야 선택"}
            </span>

            <span className="child-create-page__interest-arrow">
              ›
            </span>
          </button>

          {/* 부모 음성 */}
          <div className="child-create-page__row">
            <span className="child-create-page__label">
              부모 음성
            </span>

            <div className="child-create-page__voice-options">
              <button
                type="button"
                className={
                  useParentVoice
                    ? "child-create-page__voice-option child-create-page__voice-option--active"
                    : "child-create-page__voice-option"
                }
                onClick={() => setUseParentVoice(true)}
              >
                사용
              </button>

              <button
                type="button"
                className={
                  !useParentVoice
                    ? "child-create-page__voice-option child-create-page__voice-option--active"
                    : "child-create-page__voice-option"
                }
                onClick={() => setUseParentVoice(false)}
              >
                미사용
              </button>
            </div>
          </div>
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

      {/* 관심 분야 선택 모달 */}
      {isModalOpen && (
        <div
          className="interest-modal"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="interest-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>관심 분야 선택</h2>

            <p className="interest-modal__description">
              관심 있는 분야를 여러 개 선택할 수 있어요.
            </p>

            <div className="interest-modal__list">
              {interestOptions.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  className={
                    interests.includes(interest)
                      ? "interest-modal__item interest-modal__item--active"
                      : "interest-modal__item"
                  }
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="interest-modal__confirm"
              onClick={() => setIsModalOpen(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ChildCreatePage;