import "./startPage.css";
import { useNavigate } from "react-router-dom";

import backgroundHills from "../../assets/background_hills.svg";
import character from "../../assets/character.svg";
import readingBookIcon from "../../assets/reading_book.svg";
import profileIcon from "../../assets/profile.svg";
import speechBubble from "../../assets/start_page_speech_bubble.svg";
import Logo from "../../components/Logo/logo";

import { navigateWithAuth } from "../../utils/auth";

function StartPage() {
  const navigate = useNavigate();

  return (
    <main className="start-page">
      <Logo />

      <section className="start-menu">
        <button
          className="menu-button reading-button"
          onClick={() =>
            navigateWithAuth(navigate, "/children/select")
          }
        >
          <img src={readingBookIcon} alt="" className="menu-icon" />
          <span>독서 시작</span>
          <span className="menu-arrow">▶</span>
        </button>

        <button
          className="menu-button guardian-button"
          onClick={() =>
            navigateWithAuth(navigate, "/guardian/children")
          }
        >
          <img src={profileIcon} alt="" className="menu-icon" />
          <span>보호자 메뉴</span>
          <span className="menu-arrow">▶</span>
        </button>
      </section>

      <div className="speech-container">
        <img src={speechBubble} alt="" className="speech-bubble" />

        <div className="speech-text">
          <p>반가워!</p>
          <p>오늘은 어떤</p>
          <p>동화를 읽어볼까?</p>
        </div>
      </div>

      <img src={character} alt="StoryDream 캐릭터" className="character" />
      <img src={backgroundHills} alt="" className="background-hills" />
    </main>
  );
}

export default StartPage;