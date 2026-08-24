import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Route de mise en page pour tout ce qui exige un compte.
 *
 * L'emplacement demande est transmis dans l'etat de navigation : apres
 * connexion, le joueur revient la ou il allait. C'est ce qui fait marcher le
 * parcours « je clique sur un lien d'invitation recu par WhatsApp, je me
 * connecte, et je retombe sur l'invitation » plutot que sur le tableau de bord.
 */
const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const token = localStorage.getItem('access_token');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
