import React, { useRef, useState } from 'react';
import api from '../services/api';
import { Alert, Button } from './ui';

/**
 * C-02 / G-01 : televersement d'une image.
 *
 * Le champ fichier est masque au profit d'un bouton : le rendu natif est
 * illisible sur telephone et ne respecte pas la taille de cible tactile.
 *
 * L'API renvoie un chemin relatif (/api/media/<cle>) qu'il faut prefixer de
 * l'origine de l'API — le front et l'API ne sont pas sur la meme origine en
 * developpement.
 */
export const mediaSrc = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;

  const base = (api.defaults.baseURL ?? '').replace(/\/api$/, '');
  return `${base}${url}`;
};

type Props = {
  endpoint: string;
  currentUrl?: string | null;
  label?: string;
  onUploaded: (avatarUrl: string) => void;
};

export const AvatarUpload: React.FC<Props> = ({
  endpoint,
  currentUrl,
  label = 'Changer la photo',
  onUploaded,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append('avatar', file);
      // Content-Type volontairement absent : axios doit poser lui-meme la
      // frontiere multipart, qu'on ne peut pas ecrire a la main.
      const response = await api.post(endpoint, body);
      onUploaded(response.data.avatarUrl);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Envoi impossible');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const src = mediaSrc(currentUrl);

  return (
    <div>
      <div className="flex items-center gap-4">
        {src ? (
          <img
            src={src}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
            👤
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Envoi…' : label}
        </Button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {error && (
        <div className="mt-2">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
