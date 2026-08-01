import "./Logo.css";
import logo from "../../assets/logo.svg";
import { useNavigate } from "react-router-dom";

function Logo() {
  const navigate = useNavigate();

  return (<img
    src={logo}
    alt="StoryDream"
    className="logo"
    onClick={() => navigate("/")}
  />
  );
}

export default Logo;