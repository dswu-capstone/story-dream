import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./childEditPage.css";

type ChildDetailResponse = {
  success: boolean;
  data: {
    childId: number;
    name: string;
    birthDate: string;
    defaultLevel: number;
    interest: string[];
    useParentVoice: boolean;
  };
  message: string | null;
};

function ChildEditPage() {
  const navigate = useNavigate();
  const { childId } = useParams<{ childId: string }>();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [defaultLevel, setDefaultLevel] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [useParentVoice, setUseParentVoice] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchChild = async () => {
      if (!childId) {
        alert("아동 정보를 찾을 수 없습니다.");
        navigate("/guardian/children");
        return;
      }

      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        alert("로그인이 필요합니다.");
        navigate("/guardian/login");
        return;
      }

      try {
        const response = await fetch(`/api/children/${childId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          alert("아동 정보를 불러오지 못했습니다.");
          navigate("/guardian/children");
          return;
        }

        const result: ChildDetailResponse = await response.json();

        setName(result.data.name);
        setBirthDate(result.data.birthDate);
        setDefaultLevel(result.data.defaultLevel);
        setInterests(result.data.interest ?? []);
        setUseParentVoice(result.data.useParentVoice);
      } catch (error) {
        console.error("아동 상세 조회 오류:", error);
        alert("아동 정보를 불러오는 중 오류가 발생했습니다.");
        navigate("/guardian/children");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChild();
  }, [childId, navigate]);

  const handleUpdate = async () => {
    if (!childId || isUpdating) {
      return;
    }

    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      alert("로그인이 필요합니다.");
      navigate("/guardian/login");
      return;
    }

    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!birthDate) {
      alert("출생일을 선택해주세요.");
      return;
    }

    try {
      setIsUpdating(true);

      const response = await fetch(`/api/children/${childId}`, {
        method: "PATCH",
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
        alert("아동 정보 수정에 실패했습니다.");
        return;
      }

      alert("수정완료");
      navigate("/guardian/children");
    } catch (error) {
      console.error("아동 수정 오류:", error);
      alert("아동 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!childId || isDeleting) {
      return;
    }

    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      alert("로그인이 필요합니다.");
      navigate("/guardian/login");
      return;
    }

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/children/${childId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        alert("아동 삭제에 실패했습니다.");
        return;
      }

      navigate("/guardian/children", {
        replace: true,
      });
    } catch (error) {
      console.error("아동 삭제 오류:", error);
      alert("아동 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="child-edit-page">
        <section className="child-edit-page__panel">
          <p className="child-edit-page__loading">불러오는 중...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="child-edit-page">
      <section className="child-edit-page__panel">
        <button
          type="button"
          className="child-edit-page__back-button"
          onClick={() => navigate(-1)}
          aria-label="이전 페이지"
        >
          &lt;
        </button>

        <h1 className="child-edit-page__title">아동 상세 설정</h1>

        <button
          type="button"
          className="child-edit-page__delete-top-button"
          onClick={() => setIsDeleteModalOpen(true)}
        >
          삭제
        </button>

        <div className="child-edit-page__form">
          <label className="child-edit-page__row">
            <span className="child-edit-page__label">이름</span>

            <input
              className="child-edit-page__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="child-edit-page__row">
            <span className="child-edit-page__label">출생일</span>

            <input
              className="child-edit-page__input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <div className="child-edit-page__row">
            <span className="child-edit-page__label">초기 난이도</span>

            <div className="child-edit-page__levels">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={
                    defaultLevel === level
                      ? "child-edit-page__level child-edit-page__level--active"
                      : "child-edit-page__level"
                  }
                  onClick={() => setDefaultLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <label
            className="child-edit-page__row child-edit-page__interest-row"
          >
            <span className="child-edit-page__label">관심 분야</span>
            <textarea
              className="child-edit-page__interest-input"
              value={interests.join(", ")}
              placeholder="예: 공룡과 우주를 좋아하고 모험 이야기를 좋아해요"
              onChange={(e) =>
                setInterests(e.target.value.trim() ? [e.target.value] : [])
              }
              rows={2}
            />
          </label>

          <div className="child-edit-page__row">
            <span className="child-edit-page__label">부모 음성</span>

            <div className="child-edit-page__voice-options">
              <button
                type="button"
                className={
                  useParentVoice
                    ? "child-edit-page__voice-option child-edit-page__voice-option--active"
                    : "child-edit-page__voice-option"
                }
                onClick={() => setUseParentVoice(true)}
              >
                사용
              </button>

              <button
                type="button"
                className={
                  !useParentVoice
                    ? "child-edit-page__voice-option child-edit-page__voice-option--active"
                    : "child-edit-page__voice-option"
                }
                onClick={() => setUseParentVoice(false)}
              >
                미사용
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="child-edit-page__submit-button"
          disabled={isUpdating}
          onClick={handleUpdate}
        >
          {isUpdating ? "수정 중..." : "수정하기"}
        </button>
      </section>

      {isDeleteModalOpen && (
        <div
          className="delete-modal"
          onClick={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
            }
          }}
        >
          <div
            className="delete-modal__box"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="delete-modal__title">
              아동 정보를 삭제할까요?
            </h2>

            <p className="delete-modal__warning">
              삭제 후 복구할 수 없습니다.
            </p>

            <div className="delete-modal__buttons">
              <button
                type="button"
                className="delete-modal__cancel-button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
              >
                취소
              </button>

              <button
                type="button"
                className="delete-modal__delete-button"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default ChildEditPage;
