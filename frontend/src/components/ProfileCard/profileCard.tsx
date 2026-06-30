import "./profileCard.css";

import childProfileIcon from "../../assets/child_profile.svg";
import type { Profile } from "../../types/profile";

type ProfileCardProps = {
  profile: Profile;
};

function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <article className="profile-card">
      <div className="profile-card__corner" aria-hidden="true" />
      <img
        src={childProfileIcon}
        alt=""
        className="profile-card__icon"
        aria-hidden="true"
      />
      <strong className="profile-card__name">{profile.name}</strong>
      <div className="profile-card__star" aria-hidden="true" />
    </article>
  );
}

export default ProfileCard;
