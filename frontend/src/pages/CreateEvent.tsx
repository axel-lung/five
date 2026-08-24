import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Alert, Button, Field, inputClass, PageTitle } from '../components/ui';

const CreateEvent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    location: '',
    capacity: '10',
    price: '',
    description: '',
    venueId: '',
    groupId: searchParams.get('groupId') ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // On ne propose que les groupes dont on est membre : l'API refuse de
    // creer un evenement dans le groupe d'un autre.
    api
      .get('/groups')
      .then((res) => setGroups(res.data.filter((group: any) => group.isMember)))
      .catch(() => setGroups([]));

    // PA-03 : catalogue des complexes. Le champ lieu reste libre a cote —
    // tous les five ne se jouent pas dans un complexe reference.
    api
      .get('/venues')
      .then((res) => setVenues(res.data))
      .catch(() => setVenues([]));
  }, []);

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
      const payload: Record<string, unknown> = {
        title: formData.title,
        // datetime-local ne porte pas de fuseau ; le convertir en ISO evite
        // qu'une session de 19 h soit enregistree a 18 h ou 20 h selon le
        // fuseau du serveur.
        dateTime: new Date(formData.dateTime).toISOString(),
        capacity: Number(formData.capacity),
      };

      if (formData.location) payload.location = formData.location;
      if (formData.description) payload.description = formData.description;
      if (formData.price) payload.price = Number(formData.price);
      if (formData.groupId) payload.groupId = formData.groupId;
      if (formData.venueId) payload.venueId = formData.venueId;

      const response = await api.post('/events', payload);
      navigate(`/sessions/${response.data.id}`, { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Création impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle="Date, lieu, nombre de places. Le reste suit.">
        Créer une session
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Titre" name="title">
          <input
            id="title" type="text" name="title" required
            value={formData.title} onChange={handleChange}
            className={inputClass} disabled={loading}
            placeholder="Five du mardi"
          />
        </Field>

        <Field label="Date et heure" name="dateTime">
          <input
            id="dateTime" type="datetime-local" name="dateTime" required
            value={formData.dateTime} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field label="Lieu" name="location">
          <input
            id="location" type="text" name="location"
            value={formData.location} onChange={handleChange}
            className={inputClass} disabled={loading}
            placeholder="Le Five Reims"
          />
        </Field>

        {venues.length > 0 && (
          <Field label="Complexe" name="venueId" hint="Facultatif. Laissez vide pour un lieu libre.">
            <select
              id="venueId" name="venueId"
              value={formData.venueId} onChange={handleChange}
              className={inputClass} disabled={loading}
            >
              <option value="">Aucun</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                  {venue.city ? ` — ${venue.city}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Nombre de places" name="capacity" hint="Au-delà, les joueurs passent en liste d'attente.">
          <input
            id="capacity" type="number" name="capacity" required min={1} max={50}
            value={formData.capacity} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        <Field label="Prix indicatif (€)" name="price" hint="Le paiement en ligne arrive en V1.5.">
          <input
            id="price" type="number" name="price" min={0} step="0.5"
            value={formData.price} onChange={handleChange}
            className={inputClass} disabled={loading}
          />
        </Field>

        {groups.length > 0 && (
          <Field label="Groupe" name="groupId" hint="Une session de groupe n'est visible que de ses membres.">
            <select
              id="groupId" name="groupId"
              value={formData.groupId} onChange={handleChange}
              className={inputClass} disabled={loading}
            >
              <option value="">Sans groupe</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button type="submit" disabled={loading} full>
          {loading ? 'Création…' : 'Créer la session'}
        </Button>
      </form>
    </div>
  );
};

export default CreateEvent;
