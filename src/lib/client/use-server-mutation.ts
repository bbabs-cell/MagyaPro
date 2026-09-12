'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/client/api';
import { useToast } from '@/components/ui/toast';

/**
 * Enchaînement « j'agis, le serveur répond, l'écran se met à jour ».
 *
 * ## Le défaut que ce module corrige
 *
 * Le produit écrivait partout la même séquence :
 *
 * ```
 * setPending(true);
 * try { await api.patch(...); router.refresh(); }
 * finally { setPending(false); }
 * ```
 *
 * Elle paraît juste et ne l'est pas. `router.refresh()` ne rend pas la main
 * quand l'écran est à jour : il *demande* au serveur de refaire le rendu et
 * revient aussitôt. Le `finally` s'exécute donc alors que la réponse n'est pas
 * encore arrivée. Concrètement, sur un téléphone en 3G :
 *
 * 1. le commerçant appuie sur « Marquer prête » ;
 * 2. le bouton tourne le temps de l'appel, puis **s'arrête** ;
 * 3. la commande affiche toujours l'ancien statut — pendant une seconde ou
 *    deux, l'écran dit que c'est fini et montre le contraire ;
 * 4. le contenu saute d'un coup quand le nouveau rendu arrive.
 *
 * Entre 2 et 4, le bouton est réactivé : un commerçant pressé rappuie, et
 * l'action part une seconde fois. Ce n'est pas une lenteur, c'est un écran qui
 * ment sur son propre état.
 *
 * ## Le principe retenu
 *
 * Tout — l'appel réseau **et** le rafraîchissement — se déroule dans une
 * transition React. `isPending` reste vrai jusqu'à ce que le nouveau rendu
 * soit effectivement affiché, pas jusqu'à ce que la requête soit partie. Le
 * bouton tourne exactement le temps que dure l'attente, ni plus ni moins, et
 * reste inactif pendant tout ce temps.
 *
 * ## Pourquoi un module et non un correctif par écran
 *
 * La séquence fautive est répétée dans 70 fichiers. Corrigée à la main, elle
 * serait recopiée de travers au premier écran suivant. Ici, la règle est
 * écrite une fois ; les écrans décrivent ce qu'ils font, pas comment attendre.
 */

/** Message affiché quand l'échec n'est pas un refus explicite du serveur. */
const DEFAULT_FAILURE = "L'action n'a pas pu être effectuée. Réessayez.";

export type ServerMutationOptions<T> = {
  /**
   * Identifiant de la ligne concernée, dans une liste.
   *
   * Sans lui, une liste ne saurait pas quel bouton faire tourner et les
   * ferait tous tourner ensemble.
   */
  key?: string;
  /** Message d'échec propre à cette action, si le défaut est trop vague. */
  failureMessage?: string;
  /**
   * Confirmation affichée en cas de succès — « Produit ajouté. »,
   * « Paiement enregistré. »
   *
   * À renseigner dès que le résultat n'est pas visible de lui-même à l'écran.
   * Une ligne qui change de couleur se passe de commentaire ; un réglage
   * enregistré, un paiement encaissé ou une commande confirmée, non.
   */
  successMessage?: string;
  /** Ne pas redemander de rendu au serveur — l'écran gère son état lui-même. */
  skipRefresh?: boolean;
  /** Appelé après un succès, avant le rafraîchissement. */
  onSuccess?: (data: T) => void;
};

export type ServerMutation = {
  /**
   * Lance une action serveur. Ne rend pas de promesse : l'attente est portée
   * par `pending`, et la suite du travail par `onSuccess`.
   */
  run: <T>(mutate: () => Promise<T>, options?: ServerMutationOptions<T>) => void;
  /**
   * Un formulaire enfant vient d'enregistrer par ses propres moyens : referme,
   * confirme, et remet la liste à jour.
   *
   * Beaucoup d'écrans délèguent l'enregistrement à un sous-formulaire qui
   * possède déjà son bouton et son message d'erreur, et se contente de
   * prévenir le parent une fois fini. Le parent refermait alors le formulaire
   * et demandait un rendu — sans transition, la liste derrière restait figée
   * sur son ancien contenu puis sautait, et rien ne disait que
   * l'enregistrement avait abouti.
   */
  settled: (message: string, close?: () => void) => void;
  /** Vrai tant que l'écran n'est pas à jour — appel réseau *et* nouveau rendu. */
  pending: boolean;
  /** Vrai pour la seule ligne en cours de traitement. */
  isPending: (key: string) => boolean;
  /** Dernier échec, déjà rédigé en français. `null` s'il n'y en a pas. */
  error: string | null;
  /**
   * Erreurs par champ renvoyées par le serveur, pour les afficher sous le
   * champ concerné plutôt que dans un bandeau au-dessus du formulaire.
   *
   * Le serveur valide toujours, quoi qu'ait fait le navigateur : lui seul sait
   * qu'un code est déjà pris ou qu'une date tombe un jour de fermeture. Sans
   * cette table, un refus portant sur un champ précis n'apparaissait que comme
   * une phrase générale, à charge pour la personne de deviner lequel reprendre.
   */
  fieldErrors: Record<string, string>;
  /** Efface le message d'échec — à l'ouverture d'un formulaire, par exemple. */
  clearError: () => void;
};

export function useServerMutation(): ServerMutation {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    <T,>(mutate: () => Promise<T>, options?: ServerMutationOptions<T>) => {
      setActiveKey(options?.key ?? null);
      setError(null);
      setFieldErrors({});

      startTransition(async () => {
        try {
          const data = await mutate();
          options?.onSuccess?.(data);
          if (options?.successMessage) show(options.successMessage, 'success');

          // Après l'`await`, les mises à jour restent rattachées à la même
          // transition : `pending` ne retombera qu'une fois le nouveau rendu
          // reçu du serveur et affiché.
          if (!options?.skipRefresh) router.refresh();
        } catch (failure) {
          // `ApiError` porte un message déjà destiné à être lu par un
          // commerçant — refus de validation, droit manquant, conflit. Tout le
          // reste (panne du navigateur, exception inattendue) n'a rien à dire
          // d'utile et reçoit une phrase neutre.
          setError(
            failure instanceof ApiError
              ? failure.message
              : (options?.failureMessage ?? DEFAULT_FAILURE),
          );
          if (failure instanceof ApiError && failure.fieldErrors) {
            setFieldErrors(failure.fieldErrors);
          }
        }
      });
    },
    [router, show],
  );

  const settled = useCallback(
    (message: string, close?: () => void) => {
      close?.();
      setError(null);
      setFieldErrors({});
      show(message, 'success');
      startTransition(() => {
        router.refresh();
      });
    },
    [router, show],
  );

  const isPending = useCallback(
    (key: string) => pending && activeKey === key,
    [pending, activeKey],
  );

  const clearError = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { run, settled, pending, isPending, error, fieldErrors, clearError };
}
