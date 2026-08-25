import React, { useRef, useState } from 'react';
import api from '../services/api';

/**
 * S-01 : joindre une image a un message.
 *
 * Composant distinct d'AvatarUpload plutot qu'une option de celui-ci : il
 * poste le champ `avatar` et sert deja deux ecrans, l'elargir ferait porter
 * deux responsabilites a une seule fonction. La technique du champ fichier
 * masque, elle, est reprise telle quelle.
 */
export const ChatImageButton: React.FC<{
  groupId: string;
  disabled?: boolean;
  onSent: (message: any) => void;
  onError: (message: string) => void;
}> = ({ groupId, disabled = false, onSent, onError }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);

    try {
      const body = new FormData();
      body.append('image', file);
      // Content-Type volontairement absent : axios doit poser lui-meme la
      // frontiere multipart, qu'on ne peut pas ecrire a la main.
      const response = await api.post(`/groups/${groupId}/messages/image`, body);
      onSent(response.data);
    } catch (err: any) {
      // Les messages de l'API sont en anglais ; l'interface est en francais.
      // On traduit ici plutot que de changer la langue de l'API, comme le
      // fait deja l'ecran des notifications pour ses types d'evenement.
      const status = err.response?.status;
      onError(
        status === 400
          ? 'Image refusée : formats acceptés jpeg, png, webp, 2 Mo maximum.'
          : status === 429
            ? "Trop d'images envoyées, réessayez dans un moment."
            : 'Envoi impossible.'
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        aria-label="Joindre une image"
        className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white
                   text-lg disabled:opacity-50"
      >
        {busy ? '…' : '📷'}
      </button>

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
    </>
  );
};

export default ChatImageButton;
