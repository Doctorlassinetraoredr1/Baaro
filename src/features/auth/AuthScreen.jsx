import React from "react";
import { useApp } from "../../contexts/AppContext";

const AuthScreen = ({ onNavigate }) => {
  const { enableGuestMode } = useApp();

  const handleGuestContinue = () => {
    enableGuestMode();

    if (onNavigate) {
      onNavigate("feed");
    }
  };

  return (
    <div className="auth-container">
      <h2>Bienvenue sur Baaro</h2>

      <button
        type="button"
        onClick={handleGuestContinue}
        className="btn-secondary"
      >
        Continuer en tant qu'invité
      </button>
    </div>
  );
};

export default AuthScreen;
