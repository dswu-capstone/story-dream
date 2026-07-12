import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./profileSelectPage.css";

import { getProfiles } from "../../api/profile";
import ArrowButton from "../../components/ArrowButton/arrowButton";
import Logo from "../../components/Logo/logo";
import ProfileCard from "../../components/ProfileCard/profileCard";
import type { Profile } from "../../types/profile";

const pageTitle = "독서를 시작할 프로필을 선택해주세요";
const prevButtonLabel = "이전 프로필 보기";
const nextButtonLabel = "다음 프로필 보기";
const paginationLabel = "프로필 위치";
const emptyMessage = "등록된 프로필이 아직 없어요.";

function ProfileSelectPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const data = await getProfiles();
        setProfiles(data);
      } catch (error) {
        console.error("프로필 목록 조회 오류:", error);
        setErrorMessage("프로필 목록을 불러오지 못했어요.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfiles();
  }, []);

  useEffect(() => {
    if (profiles.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((prev) => prev % profiles.length);
  }, [profiles]);

  if (isLoading) {
    return (
      <main className="profile-select-page">
        <Logo />
        <h1 className="profile-select-page__title">{pageTitle}</h1>
        <p className="profile-select-page__empty">불러오는 중...</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="profile-select-page">
        <Logo />
        <h1 className="profile-select-page__title">{pageTitle}</h1>
        <p className="profile-select-page__empty">{errorMessage}</p>
      </main>
    );
  }

  if (profiles.length === 0) {
    return (
      <main className="profile-select-page">
        <Logo />
        <h1 className="profile-select-page__title">{pageTitle}</h1>
        <p className="profile-select-page__empty">{emptyMessage}</p>
      </main>
    );
  }

  const visibleProfiles = profiles.map(
    (_, index) => profiles[(activeIndex + index) % profiles.length],
  );

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + profiles.length) % profiles.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % profiles.length);
  };

  const handleProfileSelect = (profile: Profile) => {
    localStorage.setItem("selectedChildId", String(profile.id));
    localStorage.setItem("selectedChildName", profile.name);
    navigate(
      `/stories/recommend?childId=${profile.id}&name=${encodeURIComponent(profile.name)}`,
    );
  };

  return (
    <main className="profile-select-page">
      <Logo />

      <h1 className="profile-select-page__title">{pageTitle}</h1>

      <section className="profile-select-page__carousel">
        <ArrowButton
          direction="left"
          onClick={handlePrev}
          ariaLabel={prevButtonLabel}
        />

        <div className="profile-select-page__list">
          {visibleProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="profile-select-page__card-button"
              onClick={() => handleProfileSelect(profile)}
            >
              <ProfileCard profile={profile} />
            </button>
          ))}
        </div>

        <ArrowButton
          direction="right"
          onClick={handleNext}
          ariaLabel={nextButtonLabel}
        />
      </section>

      <div
        className="profile-select-page__pagination"
        aria-label={paginationLabel}
      >
        {profiles.map((profile, index) => (
          <span
            key={profile.id}
            className={
              index === activeIndex
                ? "profile-select-page__dot profile-select-page__dot--active"
                : "profile-select-page__dot"
            }
          />
        ))}
      </div>
    </main>
  );
}

export default ProfileSelectPage;
