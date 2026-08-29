import { useEffect, useState } from "react";
import { getProfiles } from "../../api/profile";
import type { Profile } from "../../types/profile";
import ArrowButton from "../ArrowButton/arrowButton";
import Logo from "../Logo/logo";
import ProfileCard from "../ProfileCard/profileCard";
import "./profileSelector.css";

type Props = { title: string; loadingMessage: string; emptyMessage: string; errorMessage: string; onSelect: (profile: Profile) => void };
const profilesPerPage = 3;

function ProfileSelector({ title, loadingMessage, emptyMessage, errorMessage, onSelect }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getProfiles();
        if (active) setProfiles(data);
      } catch (error) {
        console.error("프로필 목록 조회 오류:", error);
        if (active) setHasError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const totalPages = Math.ceil(profiles.length / profilesPerPage);
  const visibleProfiles = profiles.slice(currentPage * profilesPerPage, currentPage * profilesPerPage + profilesPerPage);

  return <main className="profile-selector"><Logo /><h1 className="profile-selector__title">{title}</h1>
    {isLoading || hasError || profiles.length === 0 ? <p className={`profile-selector__status${hasError ? " profile-selector__status--error" : ""}`} role={hasError ? "alert" : "status"}>{isLoading ? loadingMessage : hasError ? errorMessage : emptyMessage}</p> : <>
      <section className="profile-selector__carousel" aria-label="아동 프로필 목록">
        <ArrowButton direction="left" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} disabled={currentPage === 0} ariaLabel="이전 아동 목록 보기" />
        <div className="profile-selector__list">{visibleProfiles.map((profile) => <button key={profile.id} type="button" className="profile-selector__card" onClick={() => onSelect(profile)} aria-label={`${profile.name} 선택`}><ProfileCard profile={profile} /></button>)}</div>
        <ArrowButton direction="right" onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))} disabled={currentPage === totalPages - 1} ariaLabel="다음 아동 목록 보기" />
      </section>
      <div className="profile-selector__pagination" aria-label={`총 ${totalPages}페이지 중 ${currentPage + 1}페이지`}>{Array.from({ length: totalPages }, (_, index) => <span key={index} className={`profile-selector__dot${index === currentPage ? " profile-selector__dot--active" : ""}`} aria-hidden="true" />)}</div>
    </>}
  </main>;
}

export default ProfileSelector;
