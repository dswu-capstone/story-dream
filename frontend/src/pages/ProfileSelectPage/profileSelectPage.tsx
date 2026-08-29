import { useNavigate } from "react-router-dom";
import ProfileSelector from "../../components/ProfileSelector/profileSelector";
import type { Profile } from "../../types/profile";

function ProfileSelectPage() {
  const navigate = useNavigate();
  const handleSelect = (profile: Profile) => {
    localStorage.setItem("selectedChildId", String(profile.id));
    localStorage.setItem("selectedChildName", profile.name);
    navigate(`/stories/recommend?childId=${profile.id}&name=${encodeURIComponent(profile.name)}`);
  };

  return <ProfileSelector title="독서를 시작할 프로필을 선택해주세요" loadingMessage="불러오는 중..." emptyMessage="등록된 프로필이 아직 없어요" errorMessage="프로필 목록을 불러오지 못했어요." onSelect={handleSelect} />;
}

export default ProfileSelectPage;
