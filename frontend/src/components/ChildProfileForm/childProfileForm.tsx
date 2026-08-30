import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./childProfileForm.css";

type ChildProfileFormValues = {
  name: string;
  birthDate: string;
  defaultLevel: number;
  interest: string[];
};

type ChildProfileFormProps = {
  mode: "create" | "edit";
  initialValues: ChildProfileFormValues;
  onSubmit: (values: ChildProfileFormValues) => void;
  onDelete?: () => void;
};

const interestOptions = [
  "공주",
  "공룡",
  "자동차",
  "동물",
  "우주",
  "로봇",
  "마법",
  "모험",
  "음악",
  "그림",
  "축구",
  "바다",
];

function ChildProfileForm({
  mode,
  initialValues,
  onSubmit,
  onDelete,
}: ChildProfileFormProps) {
  const navigate = useNavigate();

  const [values, setValues] = useState(initialValues);
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);

  const handleChange = (
    field: keyof ChildProfileFormValues,
    value: string | number | string[],
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInterestToggle = (interest: string) => {
    setValues((prev) => {
      const exists = prev.interest.includes(interest);

      return {
        ...prev,
        interest: exists
          ? prev.interest.filter((item) => item !== interest)
          : [...prev.interest, interest],
      };
    });
  };

  return (
    <main className="child-profile-page">
      <section className="child-profile-page__panel">
        <button
          type="button"
          className="child-profile-page__back-button"
          onClick={() => navigate(-1)}
        >
          &lt;
        </button>

        {mode === "edit" && onDelete && (
          <button
            type="button"
            className="child-profile-page__delete-button"
            onClick={onDelete}
          >
            삭제
          </button>
        )}

        <h1 className="child-profile-page__title">아동 상세 설정</h1>

        <div className="child-profile-page__form">
          <label className="child-profile-page__row">
            <span>이름</span>
            <input
              value={values.name}
              onChange={(event) => handleChange("name", event.target.value)}
            />
          </label>

          <label className="child-profile-page__row">
            <span>출생일</span>
            <input
              type="date"
              value={values.birthDate}
              onChange={(event) =>
                handleChange("birthDate", event.target.value)
              }
            />
          </label>

          <div className="child-profile-page__row">
            <span>초기 난이도</span>

            <div className="child-profile-page__level-group">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={
                    values.defaultLevel === level
                      ? "child-profile-page__level child-profile-page__level--active"
                      : "child-profile-page__level"
                  }
                  onClick={() => handleChange("defaultLevel", level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="child-profile-page__row child-profile-page__interest-row"
            onClick={() => setIsInterestModalOpen(true)}
          >
            <span>관심 분야 (복수 선택 가능)</span>
            <strong>{values.interest.join(", ")}</strong>
          </button>

        </div>

        <button
          type="button"
          className="child-profile-page__submit-button"
          onClick={() => onSubmit(values)}
        >
          {mode === "create" ? "등록하기" : "수정하기"}
        </button>
      </section>

      {isInterestModalOpen && (
        <div className="interest-modal">
          <div className="interest-modal__content">
            <h2>관심 분야 선택</h2>

            <div className="interest-modal__options">
              {interestOptions.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  className={
                    values.interest.includes(interest)
                      ? "interest-modal__option interest-modal__option--active"
                      : "interest-modal__option"
                  }
                  onClick={() => handleInterestToggle(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="interest-modal__confirm-button"
              onClick={() => setIsInterestModalOpen(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ChildProfileForm;
export type { ChildProfileFormValues };
