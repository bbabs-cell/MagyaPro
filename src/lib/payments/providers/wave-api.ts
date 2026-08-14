import { toMajor } from '@/lib/money';
import type { PaymentProvider } from '@/lib/payments/types';

/**
 * Wave — paiement mobile via l'API Checkout officielle (docs.wave.com).
 *
 * Contrairement aux fournisseurs de `mobile-money.ts`, celui-ci appelle
 * réellement l'API de Wave : `isAvailable()` exige `WAVE_API_KEY`, et
 * `initiate()` crée une session de paiement et redirige le client vers
 * `wave_launch_url`. La confirmation arrive ensuite par webhook
 * (`/api/webhooks/paiements/wave`), jamais en supposant un succès immédiat.
 */

const WAVE_API_BASE = 'https://api.wave.com';

type WaveCheckoutSession = {
  id: string;
  wave_launch_url: string;
  checkout_status: 'open' | 'complete' | 'expired';
  payment_status: 'processing' | 'cancelled' | 'succeeded';
  client_reference?: string;
};

export const waveApiProvider: PaymentProvider = {
  id: 'wave',
  label: 'Wave',
  description: 'Paiement mobile Wave, redirection vers l\'application Wave.',
  currencies: ['XOF'],
  isAvailable: () => Boolean(process.env.WAVE_API_KEY),

  async initiate(intent) {
    const apiKey = process.env.WAVE_API_KEY;
    if (!apiKey) {
      throw new Error("Wave n'est pas configuré (WAVE_API_KEY manquant).");
    }

    // Wave exige un montant en unité majeure, sous forme de chaîne. Le XOF
    // n'a pas de décimales : `toMajor` gère cette conversion pour toute
    // devise, sans supposer un facteur 100 qui serait faux pour le XOF.
    const majorAmount = String(toMajor(intent.amount, intent.currency));

    const response = await fetch(`${WAVE_API_BASE}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: majorAmount,
        currency: intent.currency,
        client_reference: intent.reference,
        success_url: intent.returnUrl,
        error_url: intent.returnUrl,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Wave a refusé la demande de paiement (${response.status}) : ${body.slice(0, 300)}`);
    }

    const session = (await response.json()) as WaveCheckoutSession;

    return {
      status: 'PENDING',
      redirectUrl: session.wave_launch_url,
      providerRef: session.id,
      instructions: 'Vous allez être redirigé vers Wave pour finaliser le paiement.',
      metadata: { checkoutSessionId: session.id },
    };
  },
};
