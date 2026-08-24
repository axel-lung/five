import React, { useState } from 'react';
import { Button } from './ui';

/**
 * S-03 : partage externe vers WhatsApp.
 *
 * L'API de partage native du telephone est privilegiee quand elle existe —
 * c'est elle qui ouvre WhatsApp, les SMS ou le presse-papier selon ce que le
 * joueur utilise. Sur navigateur de bureau, ou elle n'existe pas, on retombe
 * sur un lien wa.me, puis sur la copie du lien.
 */
export const ShareButton: React.FC<{ url: string; text: string }> = ({ url, text }) => {
  const [copied, setCopied] = useState(false);
  const absolute = url.startsWith('http') ? url : `${window.location.origin}${url}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text, url: absolute });
        return;
      } catch {
        // Partage annule par l'utilisateur : on ne bascule pas sur WhatsApp
        // dans son dos, il a explicitement referme la feuille de partage.
        return;
      }
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${absolute}`)}`,
      '_blank',
      'noopener'
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button onClick={share} full>
        Partager
      </Button>
      <Button onClick={copy} variant="secondary" full>
        {copied ? 'Lien copié !' : 'Copier le lien'}
      </Button>
    </div>
  );
};

export default ShareButton;
