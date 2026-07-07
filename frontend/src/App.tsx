import { BrowserRouter, Route, Routes } from "react-router-dom";

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
import StoryReadingPage from "./pages/StoryReadingPage/storyReadingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/children/select" element={<ProfileSelectPage />} />
        <Route
          path="/children/level-adjust/:variant"
          element={<InteractionPage />}
        />
        <Route
          path="/stories/complete"
          element={<ReadingCompletePage />}
        />
        <Route path="/stories/recommend" element={<StoryRecommendPage />} />
        <Route path="/stories/read" element={<StoryReadingPage />} />
        <Route path="/guardian/login" element={<LoginPage />} />
        <Route path="/guardian/signup" element={<SignupPage />} />
        <Route path="/guardian/children" element={<ChildManagementPage />} />
        <Route path="/guardian/children/new" element={<ChildCreatePage />} />
        <Route path="/guardian/children/:childId" element={<ChildEditPage />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
