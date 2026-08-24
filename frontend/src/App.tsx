import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import CreateGroup from './pages/CreateGroup';
import CreateEvent from './pages/CreateEvent';
import GroupDetail from './pages/GroupDetail';
import EventDetail from './pages/EventDetail';
import JoinGroup from './pages/JoinGroup';
import SharedEvent from './pages/SharedEvent';
import Profile from './pages/Profile';
import ProfileData from './pages/ProfileData';
import VerifyEmail from './pages/VerifyEmail';
import Notifications from './pages/Notifications';
import NotificationPreferences from './pages/NotificationPreferences';
import PlayerProfile from './pages/PlayerProfile';
import Blocks from './pages/Blocks';
import AdminRoute from './components/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminReports from './pages/admin/AdminReports';
import AdminBugReports from './pages/admin/AdminBugReports';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminAudit from './pages/admin/AdminAudit';
import AdminVenues from './pages/admin/AdminVenues';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Consultables sans compte : c'est tout l'interet du lien partage
            (E-07) et de l'invitation (G-02). */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invitation/:token" element={<JoinGroup />} />
          <Route path="/e/:token" element={<SharedEvent />} />
          <Route path="/verifier-email/:token" element={<VerifyEmail />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groupes" element={<Groups />} />
            <Route path="/groupes/nouveau" element={<CreateGroup />} />
            <Route path="/groupes/:groupId" element={<GroupDetail />} />
            <Route path="/sessions/nouvelle" element={<CreateEvent />} />
            <Route path="/sessions/:eventId" element={<EventDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notifications/preferences" element={<NotificationPreferences />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/profil/donnees" element={<ProfileData />} />
            <Route path="/profil/blocages" element={<Blocks />} />
            <Route path="/joueurs/:userId" element={<PlayerProfile />} />

            {/* B-01 : ce garde ne fait que masquer. La vraie protection est
                requireAdmin cote serveur, qui relit le role en base. */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/signalements" element={<AdminReports />} />
              <Route path="/admin/anomalies" element={<AdminBugReports />} />
              <Route path="/admin/comptes" element={<AdminAccounts />} />
              <Route path="/admin/journal" element={<AdminAudit />} />
              <Route path="/admin/complexes" element={<AdminVenues />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
