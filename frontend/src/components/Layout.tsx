import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import api from '../services/api';
import { useProfile } from '../services/session';
import BottomNav from './BottomNav';
import BugReportButton from './BugReportButton';
import logo from '../assets/highfive_logo.png';
/**
 * Mise en page des ecrans authentifies.
 *
 * La navigation n'est rendue qu'une fois : une seconde copie masquee par
 * media query resterait dans le DOM, avec ses libelles et son badge en
 * double pour les lecteurs d'ecran. C'est donc le meme element qui est fixe
 * en bas sur telephone et pose sous l'en-tete au-dela de `sm:`.
 *
 * Le compteur de non-lues vient de `GET /api/notifications`, qui renvoie
 * deja `unreadCount` : pas d'appel dedie. Il est rafraichi via l'evenement
 * `notifications:refresh`, emis par l'ecran notifications quand on marque
 * quelque chose comme lu — sans quoi le badge resterait fige.
 */
export const Layout: React.FC = () => {
  const { profile } = useProfile();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const refresh = () => {
      api
        .get('/notifications', { params: { unread: 'true' } })
        .then((res) => setUnread(res.data.unreadCount ?? 0))
        .catch(() => setUnread(0));
    };

    refresh();
    window.addEventListener('notifications:refresh', refresh);
    return () => window.removeEventListener('notifications:refresh', refresh);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-center">
          <Link to="/dashboard" className="text-lg font-bold">
            <img src={logo} alt="HighFive" className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <BottomNav unread={unread} isAdmin={profile?.role === 'admin'} />

      {/* pb-24 : reserve la hauteur de la barre d'onglets, fixee en bas sur
          telephone, qui masquerait sinon le dernier bouton de la page. */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Beta : joignable depuis n'importe quel ecran, y compris celui qui
          vient de mal se comporter. */}
      <BugReportButton />
    </div>
  );
};

export default Layout;
