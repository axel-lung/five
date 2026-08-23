import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold mb-6">Five/Futsal</h1>
      <p className="text-lg text-gray-600 mb-8">
        Transformez vos sessions de five informelles en rendez-vous fiables
      </p>
      <div className="space-x-4">
        <Link to="/login" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded transition">
          Se connecter
        </Link>
        <Link to="/register" className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded transition-border border-2 border-green-500">
          S'inscrire
        </Link>
      </div>
      <div className="mt-10 text-sm text-gray-500">
        <p>Une application pour créer, remplir, payer, composer et partager vos sessions de five</p>
      </div>
    </div>
  );
};

export default Home;