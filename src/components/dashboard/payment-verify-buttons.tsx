'use client';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { AlertMessage, Button } from '@/components/ui';

/**
 * Validation d'une preuve de paiement déposée par le client, depuis la fiche
 * commande.
 *
 * La décision engage de l'argent et n'est pas symétrique : valider encaisse,
 * rejeter laisse la commande impayée. Une fois prise, les deux boutons
 * disparaissent — sans un mot, rien ne dit laquelle des deux a été
 * enregistrée, ce qui compte quand on vient d'appuyer sur l'un des deux à côté
 * de l'autre.
 */
export function PaymentVerifyButtons({ paymentId }: { paymentId: string }) {
  const mutation = useServerMutation();

  function verify(status: 'PAID' | 'FAILED') {
    mutation.run(() => api.patch(`/api/paiements/${paymentId}`, { status }), {
      key: status,
      successMessage:
        status === 'PAID'
          ? 'Paiement validé.'
          : 'Paiement refusé, la commande reste impayée.',
      failureMessage: "La vérification n'a pas pu être enregistrée.",
    });
  }

  return (
    <div className="mt-2">
      <AlertMessage message={mutation.error} className="mb-1.5" />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          loading={mutation.isPending('PAID')}
          disabled={mutation.pending}
          onClick={() => verify('PAID')}
        >
          Valider le paiement
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={mutation.isPending('FAILED')}
          disabled={mutation.pending}
          onClick={() => verify('FAILED')}
        >
          Rejeter
        </Button>
      </div>
    </div>
  );
}
