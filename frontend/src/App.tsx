import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateGroup from './pages/CreateGroup';
import CreateEvent from './pages/CreateEvent';
import GroupDetail from './pages/GroupDetail';
import EventDetail from './pages/EventDetail';
import JoinGroup from './pages/JoinGroup';
import SharedEvent from './pages/SharedEvent';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

/**
 * Les ecrans etaient auparavant declares enfants de /dashboard, mais
 * Dashboard ne rendait aucun <Outlet /> : ils ne s'affichaient jamais. Les
 * routes sont donc mises a plat, ProtectedRoute servant de route de mise en
 * page — c'est lui qui porte l'<Outlet />.
 */
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Consultables sans compte : c'est tout l'interet du lien
                partage (E-07) et de l'invitation (G-02). */}
            <Route path="/invitation/:token" element={<JoinGroup />} />
            <Route path="/e/:token" element={<SharedEvent />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/groups/new" element={<CreateGroup />} />
              <Route path="/groups/:groupId" element={<GroupDetail />} />
              <Route path="/events/new" element={<CreateEvent />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
            </Route>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
