import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useProfile } from '../services/session';
import { Loading } from './ui';

/**
 * B-01 : ecrans reserves aux administrateurs.
 *
 * Ce garde ne fait que masquer : la vraie protection est `requireAdmin` cote
 * serveur, qui relit le role en base a chaque appel. Un client ne peut jamais
 * s'auto-declarer administrateur, et le role n'est pas porte par le JWT.
 */
const AdminRoute: React.FC = () => {
  const { profile, loading } = useProfile();

  if (loading) return <Loading />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

export default AdminRoute;
