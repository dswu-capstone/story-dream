import { useEffect, useState } from "react";

import "./profileSelectPage.css";

import { getProfiles } from "../../api/profile";
import ArrowButton from "../../components/ArrowButton/arrowButton";
import Logo from "../../components/Logo/logo";
import ProfileCard from "../../components/ProfileCard/profileCard";
import type { Profile } from "../../types/profile";

const pageTitle =
  "\uB3C5\uC11C\uB97C \uC2DC\uC791\uD560 \uD504\uB85C\uD544\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694";
const prevButtonLabel =
  "\uC774\uC804 \uD504\uB85C\uD544 \uBCF4\uAE30";
const nextButtonLabel =
  "\uB2E4\uC74C \uD504\uB85C\uD544 \uBCF4\uAE30";
const paginationLabel =
  "\uD504\uB85C\uD544 \uC704\uCE58";
const emptyMessage =
  "\uB4F1\uB85D\uB41C \uD504\uB85C\uD544\uC774 \uC544\uC9C1 \uC5C6\uC5B4\uC694.";

function ProfileSelectPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const loadProfiles = async () => {
      const data = await getProfiles();
      setProfiles(data);
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
            <ProfileCard key={profile.id} profile={profile} />
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
