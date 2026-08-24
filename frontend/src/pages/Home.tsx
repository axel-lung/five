import React from 'react';
import { Link, Navigate } from 'react-router-dom';

const Home: React.FC = () => {
  if (localStorage.getItem('access_token')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="py-10 text-center">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
        Le five, sans les relances
      </h1>
      <p className="mt-3 text-gray-600 max-w-md mx-auto">
        Créez la session, partagez le lien, et voyez qui vient. La liste
        d'attente se remplit toute seule quand quelqu'un se désiste.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/register"
          className="min-h-[44px] flex items-center justify-center px-6 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
        >
          Créer un compte
        </Link>
        <Link
          to="/login"
          className="min-h-[44px] flex items-center justify-center px-6 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-semibold transition"
        >
          J'ai déjà un compte
        </Link>
      </div>
    </div>
  );
};

export default Home;
