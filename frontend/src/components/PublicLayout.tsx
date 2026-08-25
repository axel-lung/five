import React from 'react';
import { Link, Outlet } from 'react-router-dom';

// Importe et non chemin en dur : une chaine dans `src` echappe au bundler, et
// le navigateur la resout depuis l'URL de la page — donc pas depuis ce fichier.
// L'import rend l'URL finale, hachee au build, et casse la compilation si le
// fichier disparait.
import logo from '../assets/highfive_logo.png';

/**
 * Mise en page des ecrans consultables sans compte : accueil, connexion,
 * inscription, apercu d'invitation et de session partagee.
 *
 * Pas de navigation par onglets — il n'y a rien a naviguer tant qu'on n'a pas
 * de compte, et la proposer donnerait l'impression d'un mur d'inscription.
 */
export const PublicLayout: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <header className="bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-center">
        <Link to="/" className="text-lg font-bold">
          {/* Le logo est le seul contenu du lien : sans `alt`, le lien
              d'accueil n'a plus de nom pour un lecteur d'ecran. */}
          <img src={logo} alt="HighFive" className="h-10 w-auto" />
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/login"
            className="min-h-[40px] flex items-center px-3 rounded-lg hover:bg-gray-800 transition"
          >
            Connexion
          </Link>
          <Link
            to="/register"
            className="min-h-[40px] flex items-center px-3 rounded-lg bg-green-600 hover:bg-green-700 font-semibold transition"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </header>

    <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
      <Outlet />
    </main>
  </div>
);

export default PublicLayout;
