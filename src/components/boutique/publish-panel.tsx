'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card } from '@/components/ui';

/**
 * Publication du site public — miroir réduit du panneau équivalent
 * Restaurant (`settings-panels.tsx`) : ici seule la publication, pas les
 * autres réglages (SEO, domaines…), qui n'ont pas encore d'équivalent côté
 * Boutique.
 */
export function PublishPanel({
  status,
  slug,
  canPublish,
}: {
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  slug: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function togglePublication(published: boolean) {
    setPending(true);
    setError(null);
    try {
      await api.post('/api/boutique/publier', { published });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'opération a échoué.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">État de publication</h2>

      <p className="mt-3 flex items-center gap-2 text-sm">
        {status === 'ACTIVE' ? (
          <>
            <Badge tone="success">En ligne</Badge>
            <span className="text-ink-muted">Votre catalogue est accessible à vos clients.</span>
          </>
        ) : status === 'SUSPENDED' ? (
          <>
            <Badge tone="danger">Suspendue</Badge>
            <span className="text-ink-muted">
              Contactez le support Magyapro pour réactiver votre boutique.
            </span>
          </>
        ) : (
          <>
            <Badge tone="neutral">Brouillon</Badge>
            <span className="text-ink-muted">Votre catalogue n&apos;est pas encore visible du public.</span>
          </>
        )}
      </p>

      <p className="mt-4 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
        Adresse publique :{' '}
        <span className="font-mono">boutique.magyapro.com/s/{slug}</span>
      </p>

      {error && <p role="alert" className="mt-3 text-sm text-state-bad">{error}</p>}

      {canPublish && status !== 'SUSPENDED' && (
        <div className="mt-5">
          {status === 'ACTIVE' ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => togglePublication(false)}>
              {pending ? 'Traitement…' : 'Mettre la boutique hors ligne'}
            </Button>
          ) : (
            <Button type="button" size="lg" disabled={pending} onClick={() => togglePublication(true)}>
              {pending ? 'Publication…' : 'Publier ma boutique'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
