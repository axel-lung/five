import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { navBarClass, useNavBarInset } from './navShell';

/**
 * Navigation principale.
 *
 * Barre d'onglets en bas sur telephone — c'est la zone atteignable au pouce —
 * et barre horizontale a partir de `sm:`. Le meme composant sert aux deux, et
 * aux trois plateformes : dupliquer la navigation ferait diverger les copies.
 * Seul le positionnement est isole, dans `navShell`.
 */
type Tab = { to: string; label: string; icon: string; badge?: number };

const isCurrent = (pathname: string, to: string) =>
  // Le tableau de bord est prefixe de rien : sans egalite stricte, il
  // resterait actif sur toutes les autres routes.
  to === '/dashboard' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

const Item: React.FC<{ tab: Tab; active: boolean }> = ({ tab, active }) => (
  <Link href={tab.to as never} asChild>
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      className="relative flex-1 sm:flex-none min-h-[52px] sm:min-h-[40px] flex-col sm:flex-row
                 items-center justify-center gap-0.5 sm:gap-2 sm:px-3 rounded-lg"
    >
      <Text className="text-lg sm:text-base leading-none">{tab.icon}</Text>

      <Text
        className={`text-xs sm:text-sm ${
          active ? 'text-green-700 sm:text-white font-semibold' : 'text-gray-500 sm:text-gray-300'
        }`}
      >
        {tab.label}
      </Text>

      {tab.badge ? (
        <View
          accessibilityLabel={`${tab.badge} non lues`}
          className="absolute top-1 right-1/4 sm:relative sm:top-0 sm:right-0 sm:ml-1
                     min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 items-center justify-center"
        >
          <Text className="text-white text-[11px] font-bold">
            {tab.badge > 99 ? '99+' : tab.badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  </Link>
);

export const BottomNav: React.FC<{ unread?: number; isAdmin?: boolean }> = ({
  unread = 0,
  isAdmin = false,
}) => {
  const pathname = usePathname();
  const inset = useNavBarInset();

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
    <View
      role="navigation"
      accessibilityLabel="Navigation principale"
      className={navBarClass}
      style={inset === undefined ? undefined : { paddingBottom: inset }}
    >
      <View className="flex-row w-full sm:gap-1 sm:max-w-4xl sm:self-center sm:px-4 sm:py-1">
        {tabs.map((tab) => (
          <Item key={tab.to} tab={tab} active={isCurrent(pathname, tab.to)} />
        ))}
      </View>
    </View>
  );
};

export default BottomNav;
