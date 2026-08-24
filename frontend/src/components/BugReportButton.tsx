import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { Alert, Button, Field, inputClass } from './ui';

/**
 * Beta : declaration d'anomalie, depuis n'importe quel ecran connecte.
 *
 * Le bouton est flottant et non range dans un menu : une anomalie se declare
 * la ou elle se produit. Ranger l'entree dans le profil obligerait a quitter
 * l'ecran fautif, donc a le decrire de memoire — et beaucoup de testeurs
 * renonceraient en chemin.
 *
 * Le contexte technique (URL, navigateur, taille d'ecran) est capture sans
 * rien demander : c'est precisement ce qu'un testeur ne pense pas a fournir
 * et ce qui manque toujours pour reproduire.
 */
const KINDS = [
  { value: 'bug', label: 'Ça ne marche pas' },
  { value: 'display', label: "Problème d'affichage" },
  { value: 'suggestion', label: 'Suggestion' },
];

const SEVERITIES = [
  { value: 'blocking', label: 'Bloquant — impossible de continuer' },
  { value: 'major', label: 'Gênant — contournable' },
  { value: 'minor', label: 'Mineur — détail' },
];

export const BugReportButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('bug');
  const [severity, setSeverity] = useState('major');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const opener = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLSelectElement>(null);

  // L'URL au moment de l'OUVERTURE, pas de l'envoi : le formulaire ne change
  // pas de page, mais figer la valeur evite toute ambiguite si cela venait a
  // changer.
  const [contextUrl, setContextUrl] = useState('');

  const start = () => {
    setContextUrl(location.pathname + location.search);
    setError(null);
    setOpen(true);
  };

  // Le clavier doit entrer dans la boite et en ressortir la ou il etait :
  // sans cela, fermer renvoie le focus au <body> et la navigation au clavier
  // repart du haut de la page.
  useEffect(() => {
    if (open) {
      firstField.current?.focus();
    } else {
      opener.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Le message de confirmation ne doit pas rester en travers de l'ecran.
  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), 6000);
    return () => window.clearTimeout(timer);
  }, [sent]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post('/bug-reports', {
        kind,
        severity,
        description,
        context: {
          url: contextUrl,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      });

      setDescription('');
      setKind('bug');
      setSeverity('major');
      setOpen(false);
      setSent(true);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* bottom-20 sur telephone : au-dessus de la barre d'onglets, qui est
          elle-meme fixee en bas. */}
      <button
        ref={opener}
        type="button"
        onClick={start}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed z-40 right-4 bottom-20 sm:bottom-4 min-h-[44px] min-w-[44px] px-3
                   rounded-full bg-gray-900 text-white shadow-lg
                   flex items-center gap-2 text-sm font-semibold
                   hover:bg-gray-700 transition"
      >
        <span aria-hidden>🐞</span>
        <span className="hidden sm:inline">Déclarer une anomalie</span>
        <span className="sr-only sm:hidden">Déclarer une anomalie</span>
      </button>

      {sent && (
        <div
          className="fixed z-50 inset-x-4 bottom-36 sm:bottom-20 sm:left-auto sm:right-4 sm:w-80"
          role="status"
        >
          <Alert kind="success">Merci, l’anomalie est transmise à l’équipe.</Alert>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Le fond sombre ferme au clic, mais reste invisible aux lecteurs
              d'ecran : le bouton Annuler est la sortie annoncee. */}
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bugReportTitle"
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-5
                       max-h-[90vh] overflow-y-auto"
          >
            <h2 id="bugReportTitle" className="text-lg font-bold text-gray-900 mb-1">
              Déclarer une anomalie
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Merci de nous aider à améliorer Five. L’écran, votre navigateur et la taille de
              votre fenêtre sont joints automatiquement.
            </p>

            {error && (
              <div className="mb-3">
                <Alert kind="error">{error}</Alert>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <Field label="Type" name="bugKind">
                <select
                  ref={firstField}
                  id="bugKind" className={inputClass}
                  value={kind} onChange={(e) => setKind(e.target.value)}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Gravité" name="bugSeverity">
                <select
                  id="bugSeverity" className={inputClass}
                  value={severity} onChange={(e) => setSeverity(e.target.value)}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Que s’est-il passé ?"
                name="bugDescription"
                hint="Ce que vous avez fait, ce que vous attendiez, ce qui s’est produit."
              >
                <textarea
                  id="bugDescription" rows={5} className={inputClass}
                  required minLength={10} maxLength={2000}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              <p className="text-xs text-gray-500 break-all">Écran : {contextUrl}</p>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={busy} full>
                  {busy ? 'Envoi…' : 'Envoyer'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} full>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BugReportButton;
