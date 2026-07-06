import { BrowserRouter, Route, Routes } from "react-router-dom";

import StartPage from "./pages/StartPage/startPage";
import InteractionPage from "./pages/InteractionPage/interactionPage";
import LoginPage from "./pages/LoginPage/loginPage";
import ProfileSelectPage from "./pages/ProfileSelectPage/profileSelectPage";
import SignupPage from "./pages/SignupPage/signupPage";
import ChildManagementPage from "./pages/ChildManagementPage/childManagementPage";
import ChildCreatePage from "./pages/ChildCreatePage/childCreatePage";
import ChildEditPage from "./pages/ChildEditPage/childEditPage";

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
