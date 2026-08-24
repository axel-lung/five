import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Navigation principale.
 *
 * Barre d'onglets en bas sur telephone — c'est la zone atteignable au pouce —
 * et barre horizontale a partir de `sm:`. Le meme composant sert aux deux :
 * dupliquer la navigation ferait diverger les deux copies.
 */
type Tab = { to: string; label: string; icon: string; badge?: number };

const Item: React.FC<{ tab: Tab }> = ({ tab }) => (
  <NavLink
    to={tab.to}
    end={tab.to === '/dashboard'}
    className={({ isActive }) =>
      `relative flex-1 sm:flex-none min-h-[52px] sm:min-h-[40px] flex flex-col sm:flex-row
       items-center justify-center gap-0.5 sm:gap-2 sm:px-3 rounded-lg text-xs sm:text-sm
       transition ${
         isActive
           ? 'text-green-700 sm:bg-gray-800 sm:text-white font-semibold'
           : 'text-gray-500 sm:text-gray-300 hover:text-gray-800 sm:hover:text-white'
       }`
    }
  >
    <span aria-hidden className="text-lg sm:text-base leading-none">
      {tab.icon}
    </span>
    <span>{tab.label}</span>

    {tab.badge ? (
      <span
        className="absolute top-1 right-1/4 sm:static sm:ml-1 min-w-[18px] h-[18px] px-1
                   rounded-full bg-red-600 text-white text-[11px] font-bold
                   flex items-center justify-center"
        aria-label={`${tab.badge} non lues`}
      >
        {tab.badge > 99 ? '99+' : tab.badge}
      </span>
    ) : null}
  </NavLink>
);

export const BottomNav: React.FC<{ unread?: number; isAdmin?: boolean }> = ({
  unread = 0,
  isAdmin = false,
}) => {
  const tabs: Tab[] = [
    { to: '/dashboard', label: 'Sessions', icon: '⚽' },
    { to: '/groupes', label: 'Groupes', icon: '👥' },
    { to: '/notifications', label: 'Alertes', icon: '🔔', badge: unread },
    { to: '/profil', label: 'Profil', icon: '👤' },
  ];

  if (isAdmin) {
    tabs.push({ to: '/admin', label: 'Admin', icon: '🛠' });
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200
                 sm:static sm:bg-gray-800 sm:border-0"
      aria-label="Navigation principale"
    >
      {/* pb-[env(safe-area-inset-bottom)] : evite que la barre passe sous
          l'indicateur d'accueil des iPhone sans bouton. */}
      <div className="flex sm:gap-1 sm:max-w-4xl sm:mx-auto sm:px-4 sm:py-1
                      pb-[env(safe-area-inset-bottom)] sm:pb-1">
        {tabs.map((tab) => (
          <Item key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
