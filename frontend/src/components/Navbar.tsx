import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession } from '../services/api';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const connected = Boolean(localStorage.getItem('access_token'));

  const handleLogout = () => {
    // clearSession purge aussi le refresh token : ne retirer que l'access
    // token laissait une session ressuscitable par l'intercepteur.
    clearSession();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to={connected ? '/dashboard' : '/'} className="text-lg font-bold">
          Five
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {connected ? (
            <button
              onClick={handleLogout}
              className="min-h-[40px] px-3 rounded-lg hover:bg-gray-800 transition"
            >
              Déconnexion
            </button>
          ) : (
            <>
              <Link to="/login" className="min-h-[40px] flex items-center px-3 rounded-lg hover:bg-gray-800 transition">
                Connexion
              </Link>
              <Link
                to="/register"
                className="min-h-[40px] flex items-center px-3 rounded-lg bg-green-600 hover:bg-green-700 font-semibold transition"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
