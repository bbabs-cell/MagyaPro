import { redirect } from 'next/navigation';

import { setActiveStore } from '@/lib/boutique/store-tenant';

/**
 * Retour vers les autres boutiques du compte, depuis le mur d'abonnement.
 *
 * Le mur remplace le tableau de bord en entier, sélecteur de boutique compris.
 * Un commerçant qui possède deux boutiques et en ouvre une troisième non payée
 * se retrouvait donc enfermé sur celle-ci : plus de barre latérale, plus de
 * bascule, aucun chemin vers la boutique qu'il a réglée et qui, elle,
 * fonctionne. Devoir se déconnecter pour retrouver son commerce en état de
 * marche n'est pas acceptable, surtout un jour de service.
 *
 * La bascule passe par `setActiveStore`, qui vérifie l'adhésion en base avant
 * de poser le cookie : un identifiant de boutique envoyé depuis le navigateur
 * n'ouvre jamais rien à lui seul.
 *
 * Formulaires plutôt que liens : changer de boutique modifie l'état du compte,
 * ce n'est pas une navigation. Et sans JavaScript, cela fonctionne quand même.
 */
export function WallStoreSwitcher({
  stores,
}: {
  stores: Array<{ id: string; name: string; usable: boolean }>;
}) {
  async function open(storeId: string) {
    'use server';
    await setActiveStore(storeId);
    redirect('/boutique/dashboard');
  }

  // Même sans autre boutique, il faut une sortie. Un écran d'où l'on ne peut
  // ni avancer ni reculer ni se déconnecter est une impasse, pas un mur.
  if (stores.length === 0) {
    return (
      <p className="mx-auto mt-10 max-w-3xl border-t border-surface-border pt-6 text-center text-sm text-ink-muted">
        <a href="/boutique/connexion" className="underline underline-offset-4 hover:text-ink">
          Revenir à la connexion
        </a>
      </p>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-3xl border-t border-surface-border pt-6">
      <h2 className="text-sm font-medium text-ink">Vos autres boutiques</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Celle-ci attend son règlement, mais les autres restent ouvertes.
      </p>

      <ul className="mt-4 space-y-2">
        {stores.map((store) => (
          <li key={store.id}>
            <form
              action={open.bind(null, store.id)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{store.name}</span>
                {!store.usable && (
                  <span className="block text-xs text-ink-faint">
                    Abonnement à régler également
                  </span>
                )}
              </span>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
              >
                Ouvrir
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-center text-sm text-ink-muted">
        <a href="/boutique/connexion" className="underline underline-offset-4 hover:text-ink">
          Revenir à la connexion
        </a>
      </p>
    </div>
  );
}
