'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, cx, inputClass } from '@/components/ui';

/**
 * Domaines personnalisés d'une boutique — miroir du panneau équivalent
 * Restaurant (`settings-panels.tsx`), fichier séparé pointant vers
 * `/api/boutique/domaines`.
 */

type Domain = {
  id: string;
  hostname: string;
  type: 'SUBDOMAIN' | 'CUSTOM';
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  verificationToken: string;
  recordName: string;
};

export function DomainsManager({
  domains,
  cnameTarget,
  canManage,
}: {
  domains: Domain[];
  cnameTarget: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);

    try {
      await api.post('/api/boutique/domaines', {
        hostname: String(formData.get('hostname') ?? ''),
      });
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le domaine n'a pas pu être ajouté.");
    } finally {
      setPending(false);
    }
  }

  async function verify(domain: Domain) {
    setPending(true);
    setError(null);
    setDetail(null);

    try {
      const result = await api.post<{ verified: boolean; detail: string }>(
        `/api/boutique/domaines/${domain.id}`,
      );
      setDetail(result.detail);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La vérification a échoué.');
    } finally {
      setPending(false);
    }
  }

  async function remove(domain: Domain) {
    if (!window.confirm(`Retirer le domaine « ${domain.hostname} » ?`)) return;

    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/boutique/domaines/${domain.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le domaine n'a pas pu être retiré.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-medium">Domaines</h2>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {detail && (
        <div role="status" className="mt-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {detail}
        </div>
      )}

      <ul className="mt-4 divide-y divide-surface-border">
        {domains.map((domain) => (
          <li key={domain.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
                  {domain.hostname}
                  {domain.type === 'SUBDOMAIN' && <Badge tone="neutral">Magyapro</Badge>}
                  {domain.status === 'VERIFIED' && <Badge tone="success">Vérifié</Badge>}
                  {domain.status === 'PENDING' && <Badge tone="warning">En attente</Badge>}
                  {domain.status === 'FAILED' && <Badge tone="danger">Échec</Badge>}
                </p>
              </div>

              {domain.type === 'CUSTOM' && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => verify(domain)}>
                    Vérifier
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(domain)}>
                    Retirer
                  </Button>
                </div>
              )}
            </div>

            {domain.type === 'CUSTOM' && domain.status !== 'VERIFIED' && (
              <div className="mt-3 space-y-2 rounded-xl bg-surface-sunken p-3 text-xs">
                <p className="font-medium">Configuration DNS à effectuer :</p>
                <p>
                  1. Enregistrement <span className="font-mono">TXT</span> sur{' '}
                  <span className="font-mono break-all">{domain.recordName}</span> avec la valeur{' '}
                  <span className="font-mono break-all">{domain.verificationToken}</span>
                </p>
                <p>
                  2. Enregistrement <span className="font-mono">CNAME</span> de{' '}
                  <span className="font-mono">{domain.hostname}</span> vers{' '}
                  <span className="font-mono">{cnameTarget}</span>
                </p>
                <p className="text-ink-muted">
                  La propagation DNS peut prendre jusqu&apos;à 24 heures. Le certificat TLS est
                  émis automatiquement une fois le domaine vérifié.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form onSubmit={addDomain} className="mt-5 flex flex-wrap gap-2">
          <label htmlFor="hostname" className="sr-only">
            Nom de domaine
          </label>
          <input
            id="hostname"
            name="hostname"
            required
            placeholder="www.ma-boutique.com"
            className={cx(inputClass, 'flex-1 min-w-52')}
          />
          <Button type="submit" loading={pending}>
            Ajouter
          </Button>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Les domaines personnalisés sont inclus dans les plans supérieurs. Votre adresse
          Magyapro reste disponible et fonctionnelle.
        </p>
      )}
    </Card>
  );
}
