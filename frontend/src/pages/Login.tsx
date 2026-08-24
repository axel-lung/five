import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { setSession } from '../services/api';
import { Alert, Button, Field, inputClass, PageTitle } from '../components/ui';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Renvoie le joueur la ou il allait avant d'etre intercepte : un lien
  // d'invitation recu par WhatsApp ne doit pas se perdre dans la connexion.
  const destination = (location.state as any)?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data;
      setSession(accessToken, refreshToken, user);
      navigate(destination, { replace: true });
    } catch (err: any) {
      // Un compte suspendu recoit 403 et un motif : le lui dire, il est le
      // seul cas ou l'utilisateur peut agir (contacter le support).
      const data = err.response?.data;
      setError(
        data?.reason ? `${data.message} — ${data.reason}` : data?.message ?? 'Connexion impossible'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6">
      <PageTitle subtitle="Retrouvez vos groupes et vos sessions.">Connexion</PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" name="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={loading}
          />
        </Field>

        <Field label="Mot de passe" name="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={loading}
          />
        </Field>

        <Button type="submit" disabled={loading} full>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-green-700 font-semibold underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
};

export default Login;
