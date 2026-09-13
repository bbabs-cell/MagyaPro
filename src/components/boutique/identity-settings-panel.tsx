'use client';

import { useState, type FormEvent } from 'react';

import { api } from '@/lib/client/api';
import { useServerMutation } from '@/lib/client/use-server-mutation';
import { AlertMessage, Button, Card, Field, inputClass } from '@/components/ui';

/**
 * Identité de la boutique — nom, coordonnées, numéro légal.
 *
 * Ces informations étaient demandées à l'inscription puis figées : aucun écran
 * ne permettait de les corriger. Or elles figurent sur **chaque facture remise
 * à un client**. Un commerçant qui déménageait, changeait de numéro, ou avait
 * simplement fait une faute de frappe le premier jour, la voyait imprimée
 * indéfiniment.
 */
export function IdentitySettingsPanel({
  store,
  canManage,
}: {
  store: {
    name: string;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    country: string | null;
    legalId: string | null;
  };
  canManage: boolean;
}) {
  const mutation = useServerMutation();
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaved(false);

    mutation.run(
      () =>
        api.patch('/api/boutique/parametres/identite', {
          name: String(formData.get('name') ?? ''),
          phone: String(formData.get('phone') ?? ''),
          addressLine: String(formData.get('addressLine') ?? ''),
          city: String(formData.get('city') ?? ''),
          country: String(formData.get('country') ?? ''),
          legalId: String(formData.get('legalId') ?? ''),
        }),
      {
        onSuccess: () => setSaved(true),
        failureMessage: "L'enregistrement a échoué.",
      },
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Identité de la boutique</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Ce qui apparaît en haut de vos factures et de vos reçus.
      </p>

      <form onSubmit={save} className="mt-4 space-y-4" noValidate>
        <AlertMessage message={mutation.error} />

        <Field label="Nom" htmlFor="store-name" required error={mutation.fieldErrors.name}>
          <input
            id="store-name"
            name="name"
            required
            defaultValue={store.name}
            disabled={!canManage}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" htmlFor="store-phone" error={mutation.fieldErrors.phone}>
            <input
              id="store-phone"
              name="phone"
              type="tel"
              defaultValue={store.phone ?? ''}
              disabled={!canManage}
              className={inputClass}
            />
          </Field>
          <Field
            label="Numéro d'identification (facultatif)"
            htmlFor="store-legalId"
            hint="NINEA, RCCM, IFU…"
            error={mutation.fieldErrors.legalId}
          >
            <input
              id="store-legalId"
              name="legalId"
              defaultValue={store.legalId ?? ''}
              disabled={!canManage}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Adresse" htmlFor="store-address" error={mutation.fieldErrors.addressLine}>
          <input
            id="store-address"
            name="addressLine"
            defaultValue={store.addressLine ?? ''}
            disabled={!canManage}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ville" htmlFor="store-city">
            <input
              id="store-city"
              name="city"
              defaultValue={store.city ?? ''}
              disabled={!canManage}
              className={inputClass}
            />
          </Field>
          <Field label="Pays" htmlFor="store-country">
            <input
              id="store-country"
              name="country"
              defaultValue={store.country ?? ''}
              disabled={!canManage}
              className={inputClass}
            />
          </Field>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" loading={mutation.pending}>
              Enregistrer
            </Button>
            {/* Comme sur les réglages Restaurant : la confirmation reste sous
                le bouton plutôt que de s'effacer au bout de quatre secondes. */}
            {saved && !mutation.pending && (
              <span className="text-sm text-state-ok">Enregistré.</span>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
