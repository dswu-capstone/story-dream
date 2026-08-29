import { BrowserRouter, Route, Routes } from "react-router-dom";

import KioskExitButton from "./components/KioskExitButton/kioskExitButton";
import StartPage from "./pages/StartPage/startPage";
import InteractionPage from "./pages/InteractionPage/interactionPage";
import LoginPage from "./pages/LoginPage/loginPage";
import ProfileSelectPage from "./pages/ProfileSelectPage/profileSelectPage";
import ReadingCompletePage from "./pages/ReadingCompletePage/readingCompletePage";
import SignupPage from "./pages/SignupPage/signupPage";
import ChildManagementPage from "./pages/ChildManagementPage/ChildManagementPage";
import ChildCreatePage from "./pages/ChildCreatePage/childCreatePage";
import ChildEditPage from "./pages/ChildEditPage/childEditPage";
import StoryRecommendPage from "./pages/StoryRecommendPage/storyRecommendPage";
import StoryResultPage from "./pages/StoryResultPage/storyResultPage";
import StoryReadingPage from "./pages/StoryReadingPage/storyReadingPage";
import StoryQuizPage from "./pages/StoryQuizPage/storyQuizPage";
import RealtimeInteractionPage from "./pages/RealtimeInteractionPage/realtimeInteractionPage";
import ReadingSummaryPage from "./pages/ReadingSummaryPage/readingSummaryPage";
import GuardianHomePage from "./pages/GuardianHomePage/guardianHomePage";
import ReportProfileSelectPage from "./pages/ReportProfileSelectPage/reportProfileSelectPage";
import RequireGuardianAuth from "./components/RequireGuardianAuth/requireGuardianAuth";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/children/select" element={<ProfileSelectPage />} />
        <Route path="/children/level-adjust/:variant" element={<InteractionPage />} />
        <Route path="/stories/complete" element={<ReadingCompletePage />} />
        <Route path="/stories/quiz" element={<StoryQuizPage />} />
        <Route path="/stories/result" element={<StoryResultPage />} />
        <Route path="/stories/recommend" element={<StoryRecommendPage />} />
        <Route path="/stories/read" element={<StoryReadingPage />} />
        <Route path="/stories/interaction" element={<RealtimeInteractionPage />} />
        <Route path="/guardian/login" element={<LoginPage />} />
        <Route path="/guardian/signup" element={<SignupPage />} />
        <Route path="/guardian" element={<RequireGuardianAuth><GuardianHomePage /></RequireGuardianAuth>} />
        <Route path="/guardian/reports/select" element={<RequireGuardianAuth><ReportProfileSelectPage /></RequireGuardianAuth>} />
        <Route path="/guardian/reports/:childId" element={<RequireGuardianAuth><ReadingSummaryPage /></RequireGuardianAuth>} />
        <Route path="/guardian/children" element={<ChildManagementPage />} />
        <Route path="/guardian/children/new" element={<ChildCreatePage />} />
        <Route path="/guardian/children/:childId" element={<ChildEditPage />} />
        <Route path="/guardian/children/:childId/reading-summary" element={<RequireGuardianAuth><ReadingSummaryPage /></RequireGuardianAuth>} />
      </Routes>
      <KioskExitButton />
    </BrowserRouter>
  );
}

export default App;
