'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';

/**
 * Ouverture d'une boutique supplémentaire.
 *
 * Le prix est affiché par la page qui contient ce formulaire, avant le champ,
 * pas après le bouton : un engagement mensuel se lit avant de s'engager. Le
 * bouton le rappelle une dernière fois, pour que personne ne valide sans avoir
 * vu le montant.
 */
export function NewStoreForm({ confirmLabel }: { confirmLabel: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      await api.post<{ storeId: string }>('/api/boutique/nouvelle-boutique', { name });
      // La boutique créée est devenue la boutique active côté serveur. On
      // enchaîne sur sa configuration : secteur, devise, taxe. C'est le même
      // parcours qu'à l'inscription, et le mur de paiement se présentera à la
      // sortie, une fois la boutique réellement configurée.
      router.push('/boutique/bienvenue');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La boutique n'a pas pu être créée.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-md space-y-4">
      <Field
        label="Nom de la nouvelle boutique"
        htmlFor="new-store-name"
        hint="Vous pourrez le modifier ensuite, ainsi que le secteur d'activité."
        required
      >
        <input
          id="new-store-name"
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          autoComplete="off"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm font-medium text-state-bad">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? 'Création…' : confirmLabel}
      </Button>
    </form>
  );
}
