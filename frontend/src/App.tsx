import { BrowserRouter, Routes, Route } from "react-router-dom";

import StartPage from "./pages/StartPage/startPage";
import LoginPage from "./pages/LoginPage/loginPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/guardian/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;