import { BrowserRouter, Routes, Route } from "react-router-dom";

import StartPage from "./pages/StartPage/startPage";
import LoginPage from "./pages/LoginPage/loginPage";
import SignupPage from "./pages/SignupPage/signupPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/guardian/login" element={<LoginPage />} />
        <Route path="/guardian/signup" element={<SignupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;