import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import api from '../services/api';
import { useProfile } from '../services/session';
import BottomNav from './BottomNav';

/**
 * Mise en page des ecrans authentifies.
 *
 * Le compteur de non-lues vient de `GET /api/notifications`, qui renvoie deja
 * `unreadCount` : pas d'appel dedie. Il est rafraichi a la navigation via
 * l'evenement `notifications:refresh`, emis par l'ecran notifications quand
 * on marque quelque chose comme lu — sans quoi le badge resterait fige.
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
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="text-lg font-bold shrink-0">
            Five
          </Link>

          <div className="hidden sm:block">
            <BottomNav unread={unread} isAdmin={profile?.role === 'admin'} />
          </div>
        </div>
      </header>

      {/* pb-24 : reserve la hauteur de la barre d'onglets, qui est fixee en
          bas sur telephone et masquerait sinon le dernier bouton. */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      <div className="sm:hidden">
        <BottomNav unread={unread} isAdmin={profile?.role === 'admin'} />
      </div>
    </div>
  );
};

export default Layout;
