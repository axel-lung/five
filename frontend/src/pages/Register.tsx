import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { setSession } from '../services/api';
import { Alert, Button, Field, inputClass, PageTitle } from '../components/ui';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    // C-01 : consentements separes. Les CGU sont obligatoires cote API.
    acceptTos: false,
    acceptMarketing: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const destination = (location.state as any)?.from?.pathname ?? '/dashboard';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Les champs facultatifs laisses vides sont retires plutot qu'envoyes
      // a '' : Joi refuse une chaine vide la ou il attend un nom ou une
      // ville. Les booleens des consentements traversent ce filtre.
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
      );
      const response = await api.post('/auth/register', payload);
      const { user, accessToken, refreshToken } = response.data;
      setSession(accessToken, refreshToken, user);
      navigate(destination, { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6">
      <PageTitle subtitle="Deux minutes, et vous êtes sur la prochaine session.">
        Créer un compte
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" name="email">
          <input
            id="email" type="email" name="email" autoComplete="email" required
            value={formData.email} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field label="Mot de passe" name="password" hint="6 caractères minimum.">
          <input
            id="password" type="password" name="password" autoComplete="new-password" required
            minLength={6} value={formData.password} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field label="Prénom" name="firstName">
          <input
            id="firstName" type="text" name="firstName" autoComplete="given-name"
            value={formData.firstName} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field label="Ville" name="city">
          <input
            id="city" type="text" name="city" autoComplete="address-level2"
            value={formData.city} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <div className="space-y-3 pt-2">
          <label htmlFor="acceptTos" className="flex items-start gap-3 text-sm text-gray-700">
            <input
              id="acceptTos" type="checkbox" name="acceptTos" required
              checked={formData.acceptTos} onChange={handleChange}
              className="mt-1 h-5 w-5" disabled={loading}
            />
            <span>J'accepte les conditions générales d'utilisation.</span>
          </label>

          <label htmlFor="acceptMarketing" className="flex items-start gap-3 text-sm text-gray-700">
            <input
              id="acceptMarketing" type="checkbox" name="acceptMarketing"
              checked={formData.acceptMarketing} onChange={handleChange}
              className="mt-1 h-5 w-5" disabled={loading}
            />
            <span>Je souhaite recevoir les actualités de Five (facultatif).</span>
          </label>
        </div>

        <Button type="submit" disabled={loading || !formData.acceptTos} full>
          {loading ? 'Création…' : "S'inscrire"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Déjà un compte ?{' '}
        <Link to="/login" className="text-green-700 font-semibold underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
};

export default Register;
