import React from 'react';

/**
 * Briques d'interface partagees.
 *
 * Mobile d'abord : les cibles tactiles font au moins 44 px de haut, les
 * champs 16 px de police — en dessous, Safari iOS zoome automatiquement a la
 * mise au point et casse la mise en page.
 */

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`bg-white border border-gray-200 rounded-xl p-4 sm:p-5 ${className}`}>
    {children}
  </div>
);

export const PageTitle: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({
  children,
  subtitle,
}) => (
  <div className="mb-5">
    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{children}</h1>
    {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
  </div>
);

export const Alert: React.FC<{ kind?: 'error' | 'success' | 'info'; children: React.ReactNode }> = ({
  kind = 'info',
  children,
}) => {
  const tones = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${tones[kind]}`} role="alert">
      {children}
    </div>
  );
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  full?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  full = false,
  className = '',
  ...props
}) => {
  const tones = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      {...props}
      className={`min-h-[44px] px-5 rounded-lg font-semibold transition
        disabled:opacity-50 disabled:cursor-not-allowed
        ${tones[variant]} ${full ? 'w-full' : ''} ${className}`}
    />
  );
};

type FieldProps = {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
};

export const Field: React.FC<FieldProps> = ({ label, name, hint, children }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

/** text-base et non text-sm : en dessous de 16 px, iOS zoome a la saisie. */
export const inputClass =
  'w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent';

export const Loading: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <div className="flex items-center justify-center py-12 text-gray-500">{label}</div>
);

/** Etat d'un evenement, lisible d'un coup d'oeil. */
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const labels: Record<string, string> = {
    draft: 'Brouillon',
    open: 'Ouvert',
    full: 'Complet',
    completed: 'Terminé',
    cancelled: 'Annulé',
  };

  const tones: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    open: 'bg-green-100 text-green-800',
    full: 'bg-orange-100 text-orange-800',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tones[status] ?? tones.draft}`}>
      {labels[status] ?? status}
    </span>
  );
};

/** Format long en francais, utilise partout ou une date s'affiche. */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
