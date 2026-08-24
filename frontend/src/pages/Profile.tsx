import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Profile as ProfileType } from '../services/session';
import AvatarUpload from '../components/AvatarUpload';
import { Alert, Button, Card, Field, inputClass, Loading, PageTitle } from '../components/ui';

/** C-03 : creneaux proposes. Etiquettes libres cote API, liste fermee ici. */
const SLOTS = [
  { value: 'lundi-soir', label: 'Lundi soir' },
  { value: 'mardi-soir', label: 'Mardi soir' },
  { value: 'mercredi-soir', label: 'Mercredi soir' },
  { value: 'jeudi-soir', label: 'Jeudi soir' },
  { value: 'vendredi-soir', label: 'Vendredi soir' },
  { value: 'samedi', label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
];

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/users/profile')
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!profile) return <Alert kind="error">{error ?? 'Profil introuvable'}</Alert>;

  const set = (patch: Partial<ProfileType>) =>
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

  const toggleSlot = (slot: string) => {
    const slots = profile.preferredSlots ?? [];
    set({
      preferredSlots: slots.includes(slot)
        ? slots.filter((s) => s !== slot)
        : [...slots, slot],
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      // Seuls les champs modifiables partent, et les chaines vides sont
      // retirees : Joi refuse '' la ou il attend un nom ou une ville.
      const payload: Record<string, unknown> = {
        preferredSlots: profile.preferredSlots ?? [],
        travelRadiusKm: profile.travelRadiusKm === null ? null : profile.travelRadiusKm,
      };

      for (const key of ['firstName', 'lastName', 'phone', 'city', 'bio', 'preferredPosition'] as const) {
        const value = profile[key];
        if (value) payload[key] = value;
      }
      if (profile.selfDeclaredLevel) payload.selfDeclaredLevel = profile.selfDeclaredLevel;

      const response = await api.put('/users/profile', payload);
      setProfile(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      setNotice('Profil enregistré.');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    setError(null);
    try {
      const response = await api.post('/auth/verify-email');
      // Hors production, l'API renvoie le jeton pour permettre un test bout
      // en bout : on affiche alors le lien directement.
      setVerifySent(response.data.token ?? null);
      setNotice('Email de vérification envoyé.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Envoi impossible');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle={profile.email}>Mon profil</PageTitle>

      {notice && (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-4">
        <AvatarUpload
          endpoint="/users/avatar"
          currentUrl={profile.avatarUrl}
          onUploaded={(avatarUrl) => {
            set({ avatarUrl });
            setNotice('Photo mise à jour.');
          }}
        />
      </Card>

      {/* C-05 : verification de l'adresse email. */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">Adresse email</p>
            <p className="text-sm text-gray-600">
              {profile.emailVerified ? 'Vérifiée' : 'Non vérifiée'}
            </p>
          </div>
          {!profile.emailVerified && (
            <Button type="button" variant="secondary" onClick={requestVerification}>
              Vérifier
            </Button>
          )}
        </div>

        {verifySent && (
          <p className="text-xs text-gray-500 mt-3 break-all">
            Mode développement — lien direct :{' '}
            <Link to={`/verifier-email/${verifySent}`} className="text-green-700 underline">
              /verifier-email/{verifySent}
            </Link>
          </p>
        )}
      </Card>

      <form onSubmit={save} className="space-y-4">
        <Field label="Prénom" name="firstName">
          <input
            id="firstName" type="text" className={inputClass}
            value={profile.firstName ?? ''}
            onChange={(e) => set({ firstName: e.target.value })}
          />
        </Field>

        <Field label="Nom" name="lastName">
          <input
            id="lastName" type="text" className={inputClass}
            value={profile.lastName ?? ''}
            onChange={(e) => set({ lastName: e.target.value })}
          />
        </Field>

        <Field label="Ville" name="city">
          <input
            id="city" type="text" className={inputClass}
            value={profile.city ?? ''}
            onChange={(e) => set({ city: e.target.value })}
          />
        </Field>

        <Field label="Poste préféré" name="preferredPosition">
          <input
            id="preferredPosition" type="text" className={inputClass}
            placeholder="Gardien, défenseur, attaquant…"
            value={profile.preferredPosition ?? ''}
            onChange={(e) => set({ preferredPosition: e.target.value })}
          />
        </Field>

        <Field label="Niveau auto-déclaré" name="selfDeclaredLevel" hint="De 1 (débutant) à 5 (confirmé).">
          <select
            id="selfDeclaredLevel" className={inputClass}
            value={profile.selfDeclaredLevel ?? ''}
            onChange={(e) =>
              set({ selfDeclaredLevel: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Non renseigné</option>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </Field>

        {/* C-03 : disponibilites. */}
        <Field label="Créneaux préférés" name="preferredSlots">
          <div className="grid grid-cols-2 gap-2">
            {SLOTS.map((slot) => {
              const active = (profile.preferredSlots ?? []).includes(slot.value);
              return (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => toggleSlot(slot.value)}
                  aria-pressed={active}
                  className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium transition ${
                    active
                      ? 'bg-green-50 border-green-500 text-green-800'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Rayon de déplacement (km)" name="travelRadiusKm">
          <input
            id="travelRadiusKm" type="number" min={0} max={200} className={inputClass}
            value={profile.travelRadiusKm ?? ''}
            onChange={(e) =>
              set({ travelRadiusKm: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </Field>

        <Button type="submit" disabled={saving} full>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <Link to="/profil/donnees" className="text-sm text-gray-600 underline">
          Mes données et mon compte
        </Link>
      </div>
    </div>
  );
};

export default Profile;
