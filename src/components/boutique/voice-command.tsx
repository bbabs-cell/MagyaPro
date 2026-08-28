'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  VOICE_EXAMPLES,
  needsConfirmation,
  parseVoiceCommand,
  type VoiceIntent,
} from '@/lib/boutique/voice-grammar';
import { Button, cx } from '@/components/ui';

/**
 * Commandes vocales à la caisse.
 *
 * La reconnaissance de la parole est faite par le navigateur (Web Speech
 * API) : rien n'est envoyé à un service payant, aucune clé d'API n'est
 * nécessaire, et l'interprétation de la phrase est une grammaire de règles
 * (voir `voice-grammar.ts`) — pas un modèle. La même phrase donne toujours le
 * même résultat.
 *
 * Deux garde-fous, parce qu'une caisse manipule de l'argent :
 *
 * 1. **Rien n'est exécuté en silence.** Ce qui a été compris est toujours
 *    affiché en clair, et les actions sensibles — encaisser, vider le panier,
 *    retirer une ligne — demandent une confirmation avant d'agir.
 * 2. **Repli clavier systématique.** Là où l'API manque (Firefox, certains
 *    navigateurs mobiles) ou quand le micro est refusé, la même phrase peut
 *    être tapée et suit exactement le même chemin. L'application n'est jamais
 *    bloquée par l'absence de micro.
 */

/** Types minimaux de la Web Speech API — absente des définitions du DOM. */
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** Ce que le parent sait faire d'une intention, une fois résolue sur son catalogue. */
export type VoiceResolution = { label: string } | { error: string };

export function VoiceCommandButton({
  describe,
  execute,
  disabled = false,
  className,
}: {
  /**
   * Traduit l'intention en phrase lisible (« 3 cartons d'Eau minérale »), ou
   * explique pourquoi elle est inapplicable. C'est le parent qui connaît le
   * catalogue et le panier — la grammaire, elle, ne connaît que les mots.
   */
  describe: (intent: VoiceIntent) => VoiceResolution;
  execute: (intent: VoiceIntent) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ intent: VoiceIntent; label: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [showTyping, setShowTyping] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Détecté après le montage : `window` n'existe pas au rendu serveur, et
  // deux balisages différents provoqueraient une erreur d'hydratation.
  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
  }, []);

  const handleTranscript = useCallback(
    (transcript: string) => {
      setHeard(transcript);
      setError(null);
      setFeedback(null);

      const intent = parseVoiceCommand(transcript);
      if (intent.kind === 'unknown') {
        setError("Commande non reconnue. Dites par exemple « ajoute 2 bouteilles d'eau ».");
        return;
      }

      const resolution = describe(intent);
      if ('error' in resolution) {
        setError(resolution.error);
        return;
      }

      // Encaisser, vider le panier ou retirer une ligne ne se fait jamais sur
      // une phrase mal comprise : on montre ce qui va se passer, et on attend.
      if (needsConfirmation(intent)) {
        setPending({ intent, label: resolution.label });
        return;
      }

      execute(intent);
      setFeedback(resolution.label);
    },
    [describe, execute],
  );

  // Libère le micro si le composant disparaît pendant l'écoute.
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  function startListening() {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setShowTyping(true);
      return;
    }
    setError(null);
    setFeedback(null);
    setPending(null);
    setHeard(null);

    const recognition = new Recognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) handleTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? "L'accès au micro a été refusé. Autorisez-le, ou tapez la commande."
          : event.error === 'no-speech'
            ? "Rien n'a été entendu. Réessayez, ou tapez la commande."
            : "La reconnaissance vocale n'a pas fonctionné. Tapez la commande.",
      );
      setShowTyping(true);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setShowTyping(true);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function submitTyped() {
    const value = typed.trim();
    if (!value) return;
    setTyped('');
    handleTranscript(value);
  }

  return (
    <div className={cx('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={listening ? 'danger' : 'secondary'}
          onClick={listening ? stopListening : startListening}
          disabled={disabled}
          aria-pressed={listening}
        >
          <MicIcon />
          {listening ? 'À l’écoute… toucher pour arrêter' : 'Commande vocale'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowTyping((value) => !value)}
          disabled={disabled}
        >
          {showTyping ? 'Masquer la saisie' : 'Taper la commande'}
        </Button>
      </div>

      {supported === false ? (
        <p className="text-xs text-ink-muted">
          Votre navigateur ne gère pas la dictée. Tapez la commande : elle est comprise exactement
          de la même façon.
        </p>
      ) : null}

      {showTyping ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitTyped();
          }}
        >
          <label className="sr-only" htmlFor="voice-typed">
            Taper une commande
          </label>
          <input
            id="voice-typed"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="ajoute 2 bouteilles d’eau"
            autoComplete="off"
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <Button type="submit" disabled={typed.trim().length === 0}>
            Exécuter
          </Button>
        </form>
      ) : null}

      {heard ? (
        <p className="text-xs text-ink-muted">
          Entendu : <span className="italic">« {heard} »</span>
        </p>
      ) : null}

      {pending ? (
        <div
          role="alertdialog"
          aria-label="Confirmer la commande vocale"
          className="rounded-lg border border-state-warn/40 bg-state-warn-soft px-3 py-2 text-sm"
        >
          <p className="font-medium">{pending.label}</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                execute(pending.intent);
                setFeedback(pending.label);
                setPending(null);
              }}
            >
              Confirmer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p role="status" className="text-sm text-state-ok">
          {feedback}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-state-bad">
          {error}
        </p>
      ) : null}

      <details className="text-xs text-ink-muted">
        <summary className="cursor-pointer">Commandes reconnues</summary>
        <ul className="mt-1.5 space-y-0.5 pl-4">
          {VOICE_EXAMPLES.map((example) => (
            <li key={example} className="list-disc">
              « {example} »
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
