import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Alert, Button, Field, inputClass, PageTitle } from '../components/ui';

const CreateGroup: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    accessType: 'private',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Les champs vides sont retires plutot qu'envoyes a '' : Joi refuse une
      // chaine vide la ou il attend une ville ou une description.
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
      );
      const response = await api.post('/groups', payload);
      navigate(`/groups/${response.data.id}`, { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Création impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle="Le noyau de joueurs que vous retrouvez chaque semaine.">
        Créer un groupe
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nom du groupe" name="name">
          <input
            id="name" type="text" name="name" required
            value={formData.name} onChange={handleChange}
            className={inputClass} disabled={loading}
            placeholder="Les Rémois"
          />
        </Field>

        <Field label="Ville" name="city">
          <input
            id="city" type="text" name="city"
            value={formData.city} onChange={handleChange}
            className={inputClass} disabled={loading}
            placeholder="Reims"
          />
        </Field>

        <Field label="Description" name="description">
          <textarea
            id="description" name="description" rows={3}
            value={formData.description} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field
          label="Visibilité"
          name="accessType"
          hint="Un groupe privé n'est visible que de ses membres."
        >
          <select
            id="accessType" name="accessType"
            value={formData.accessType} onChange={handleChange}
            className={inputClass} disabled={loading}
          >
            <option value="private">Privé</option>
            <option value="public">Public</option>
          </select>
        </Field>

        <Button type="submit" disabled={loading} full>
          {loading ? 'Création…' : 'Créer le groupe'}
        </Button>
      </form>
    </div>
  );
};

export default CreateGroup;
