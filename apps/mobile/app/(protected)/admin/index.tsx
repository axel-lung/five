import React from 'react';
import ComingSoon from '../../../components/ComingSoon';

// TODO Phase 2 : portage du back-office (B-01/02/03/06), derriere un
// app/(protected)/admin/_layout.tsx qui reprend AdminRoute.
export default function AdminHome() {
  return (
    <ComingSoon title="Back-office">
      La modération, le support et le journal d'audit se consultent pour l'instant depuis la
      version web.
    </ComingSoon>
  );
}
