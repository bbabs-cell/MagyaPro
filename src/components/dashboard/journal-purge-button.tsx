'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button } from '@/components/ui';

export function JournalPurgeButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function purge() {
    if (
      !window.confirm(
        "Supprimer définitivement les entrées du journal de plus de 12 mois ? Cette action est irréversible.",
      )
    ) {
      return;
    }

    setPending(true);
    try {
      const result = await api.post<{ deleted: number }>('/api/journal/purge', {});
      window.alert(`${result.deleted} entrée${result.deleted > 1 ? 's supprimées' : ' supprimée'}.`);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "La purge n'a pas pu être effectuée.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={purge}>
      {pending ? 'Purge…' : 'Purger (+12 mois)'}
    </Button>
  );
}
