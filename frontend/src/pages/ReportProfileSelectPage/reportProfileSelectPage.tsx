import { useNavigate } from "react-router-dom";
import ProfileSelector from "../../components/ProfileSelector/profileSelector";

function ReportProfileSelectPage() {
  const navigate = useNavigate();
  return <ProfileSelector title="독서 리포트를 볼 아이를 선택해주세요" loadingMessage="아이 목록을 불러오고 있어요." emptyMessage="등록된 아이가 아직 없어요." errorMessage="아이 목록을 불러오지 못했어요." onSelect={(profile) => navigate(`/guardian/reports/${profile.id}`)} />;
}

export default ReportProfileSelectPage;
