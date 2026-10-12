'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/client/api';
import { Button, cx } from '@/components/ui';

/**
 * Activation des alertes push sur l'appareil courant.
 *
 * Un réglage **par appareil**, pas par compte : c'est le navigateur de ce
 * téléphone qui s'abonne, et un patron peut vouloir être réveillé sur son
 * téléphone sans que la tablette de la caisse sonne aussi.
 *
 * Chaque état dit quoi faire, plutôt qu'un bouton qui ne marcherait pas :
 * navigateur trop ancien, iPhone qui exige d'abord d'ajouter l'application à
 * l'écran d'accueil, autorisation refusée (à rétablir dans les réglages du
 * navigateur), fonction pas encore disponible sur l'instance.
 */

type State =
  | 'loading'
  | 'unsupported'
  | 'ios-install'
  | 'unavailable'
  | 'denied'
  | 'off'
  | 'on';

/** Convertit la clé publique VAPID (base64url) au format attendu par `subscribe`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration(scope: string): Promise<ServiceWorkerRegistration> {
  // Le même agent que le hors-ligne (`/sw-app.js`) : l'enregistrer à nouveau
  // ne fait rien s'il l'est déjà, et le garantit s'il ne l'est pas (accès
  // support, premier passage).
  await navigator.serviceWorker.register('/sw-app.js', { scope });
  return navigator.serviceWorker.ready;
}

export function PushToggle({
  scope,
  variant = 'card',
  onDismiss,
}: {
  scope: '/dashboard' | '/boutique/dashboard';
  /** `banner` : invitation compacte de l'accueil, masquée une fois activée. */
  variant?: 'card' | 'banner';
  onDismiss?: () => void;
}) {
  const [state, setState] = useState<State>('loading');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }
    if (!('PushManager' in window)) {
      setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }

    try {
      const key = await api.get<{ enabled: boolean; publicKey: string | null }>('/api/push/key');
      if (!key.enabled || !key.publicKey) {
        setState('unavailable');
        return;
      }
      setPublicKey(key.publicKey);
    } catch {
      setState('unavailable');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    const existing = await (await registration(scope)).pushManager.getSubscription();
    if (existing && Notification.permission === 'granted') {
      // Ré-enregistre l'abonnement auprès du compte connecté : sur un appareil
      // partagé, c'est désormais lui qui doit recevoir les alertes.
      await api.post('/api/push/subscriptions', existing.toJSON()).catch(() => undefined);
      setState('on');
    } else {
      setState('off');
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await registration(scope);
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      await api.post('/api/push/subscriptions', subscription.toJSON());
      setState('on');
      // Un essai tout de suite : on voit que ça marche au moment où l'on
      // vient de l'activer, pas à la première commande manquée.
      await api.post('/api/push/test');
      setMessage('Alertes activées. Une notification d’essai vient d’être envoyée.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'L’activation a échoué. Réessayez, ou vérifiez les réglages de notification du navigateur.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await (await registration(scope)).pushManager.getSubscription();
      if (subscription) {
        await api.delete(`/api/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`);
        await subscription.unsubscribe();
      }
      setState('off');
      setMessage('Alertes désactivées sur cet appareil.');
    } catch {
      setMessage('La désactivation a échoué. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const { delivered } = await api.post<{ delivered: number }>('/api/push/test');
      setMessage(
        delivered > 0
          ? 'Notification d’essai envoyée.'
          : 'Aucun appareil n’a accepté le message. Désactivez puis réactivez les alertes.',
      );
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'L’essai a échoué.');
    } finally {
      setBusy(false);
    }
  }

  const product = scope === '/boutique/dashboard' ? 'boutique' : 'restaurant';
  const promise =
    product === 'restaurant'
      ? 'Nouvelles commandes, preuves de paiement et appels de table sonnent sur ce téléphone, même écran éteint et tableau de bord fermé.'
      : 'Ruptures de stock, paiements de crédit et échéances d’abonnement arrivent sur ce téléphone, même application fermée.';

  if (variant === 'banner') {
    // L'invitation n'a de sens que si elle peut aboutir d'un geste.
    if (state !== 'off') return null;
    return (
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink">Ne manquez plus une commande</p>
          <p className="mt-0.5 text-sm text-ink-muted">{promise}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Secondaire : l'accueil a déjà son action principale. */}
          <Button variant="secondary" onClick={enable} disabled={busy}>
            Activer les alertes
          </Button>
          {onDismiss && (
            <Button variant="ghost" onClick={onDismiss}>
              Plus tard
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-ink">
            Alertes sur cet appareil
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                state === 'on' ? 'bg-state-ok-soft text-state-ok' : 'bg-surface-sunken text-ink-muted',
              )}
            >
              {state === 'on' ? 'Activées' : state === 'loading' ? '…' : 'Désactivées'}
            </span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">{promise}</p>
          <p className="mt-2 text-sm text-ink-muted">{stateHint(state)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {state === 'off' && (
            <Button onClick={enable} disabled={busy}>
              Activer
            </Button>
          )}
          {state === 'on' && (
            <>
              <Button variant="secondary" onClick={test} disabled={busy}>
                Envoyer un essai
              </Button>
              <Button variant="ghost" onClick={disable} disabled={busy}>
                Désactiver
              </Button>
            </>
          )}
        </div>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-ink">
          {message}
        </p>
      )}
    </div>
  );
}

function stateHint(state: State): string {
  switch (state) {
    case 'loading':
      return 'Vérification de cet appareil…';
    case 'unsupported':
      return 'Ce navigateur ne sait pas recevoir d’alertes. Utilisez Chrome, Firefox, Edge ou Safari à jour.';
    case 'ios-install':
      return 'Sur iPhone, ajoutez d’abord MagyaPro à l’écran d’accueil (bouton Partager, puis « Sur l’écran d’accueil »), ouvrez-le depuis cette icône, puis revenez ici.';
    case 'unavailable':
      return 'Les alertes ne sont pas encore disponibles sur cette installation de MagyaPro.';
    case 'denied':
      return 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône du cadenas à gauche de l’adresse), puis rechargez la page.';
    case 'off':
      return 'Le navigateur vous demandera votre accord.';
    case 'on':
      return 'Pour arrêter, désactivez-les ici : les autres appareils ne sont pas concernés.';
  }
}

const INVITE_DISMISSED_KEY = 'magyapro:push-invite-dismissed';

/**
 * Invitation de l'accueil : n'apparaît que si l'activation est possible d'un
 * geste, et plus du tout après « Plus tard » sur cet appareil. Le réglage
 * reste accessible à tout moment depuis la page Notifications.
 */
export function PushInvite({ scope }: { scope: '/dashboard' | '/boutique/dashboard' }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(INVITE_DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <PushToggle
      scope={scope}
      variant="banner"
      onDismiss={() => {
        setDismissed(true);
        try {
          window.localStorage.setItem(INVITE_DISMISSED_KEY, '1');
        } catch {
          // Navigation privée : l'invitation reviendra, sans autre conséquence.
        }
      }}
    />
  );
}
