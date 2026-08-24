import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth/session';
import { storeTemplatePreviewUrl, templatePreviewUrl } from '@/lib/storage';
import { PREMIUM_TEMPLATE_KEYS, TEMPLATES } from '@/lib/templates/registry';
import { getStoreTemplates } from '@/lib/boutique/store-templates';
import { TemplatePreviewUpload } from '@/components/admin/template-preview-upload';
import { StoreTemplatePreviewUpload } from '@/components/admin/store-template-preview-upload';

export const metadata: Metadata = { title: 'Templates' };
export const dynamic = 'force-dynamic';

export default async function AdminTemplatesPage() {
  await requireSuperAdmin();

  const [templates, usage, storeTemplates, storeUsage] = await Promise.all([
    prisma.template.findMany({ orderBy: { position: 'asc' } }),
    prisma.restaurant.groupBy({ by: ['templateKey'], _count: true }),
    getStoreTemplates(),
    prisma.store.groupBy({ by: ['templateKey'], _count: true }),
  ]);

  const usageByKey = new Map(usage.map((row) => [row.templateKey, row._count]));
  const storeUsageByKey = new Map(storeUsage.map((row) => [row.templateKey, row._count]));

  // Un template inscrit en base mais absent du registre ne saurait pas se
  // rendre : la page le signale plutôt que de laisser la panne se découvrir
  // sur le site d'un client.
  const registryKeys = new Set(TEMPLATES.map((template) => template.key));
  const orphans = templates.filter((template) => !registryKeys.has(template.key));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
      <p className="mt-1 text-sm text-white/60">
        Les templates disponibles pour les sites publics. Leur rendu est défini
        dans le code ; cette table contrôle leur disponibilité.
      </p>

      {orphans.length > 0 && (
        <p role="alert" className="mt-6 rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
          {orphans.length} template{orphans.length > 1 ? 's' : ''} en base
          n&apos;{orphans.length > 1 ? 'ont' : 'a'} pas de rendu correspondant
          dans le code ({orphans.map((template) => template.key).join(', ')}).
          Les restaurants concernés retombent sur le template par défaut.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const count = usageByKey.get(template.key) ?? 0;

          return (
            <div key={template.id} className="rounded-2xl border border-white/10 p-4">
              <TemplatePreviewUpload
                templateKey={template.key}
                previewUrl={templatePreviewUrl(template.key)}
              />
              <h2 className="flex flex-wrap items-center gap-2 font-medium">
                {template.name}
                {PREMIUM_TEMPLATE_KEYS.has(template.key) && (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                    Premium
                  </span>
                )}
                {!template.isActive && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                    Inactif
                  </span>
                )}
              </h2>
              <p className="mt-1 font-mono text-xs text-white/40">{template.key}</p>
              {template.description && (
                <p className="mt-2 text-sm text-white/60">{template.description}</p>
              )}
              <p className="mt-3 text-sm">
                {count} restaurant{count > 1 ? 's' : ''} l&apos;utilise
                {count > 1 ? 'nt' : ''}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Templates Boutique</h2>
      <p className="mt-1 text-sm text-white/60">
        Les mises en page du site public de MagyaPro Boutique. Comme pour Restaurant, le rendu est
        défini dans le code — cette table contrôle leur disponibilité.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {storeTemplates.map((template) => {
          const count = storeUsageByKey.get(template.key) ?? 0;

          return (
            <div key={template.id} className="rounded-2xl border border-white/10 p-4">
              <StoreTemplatePreviewUpload
                templateKey={template.key}
                previewUrl={storeTemplatePreviewUrl(template.key)}
              />
              <h3 className="font-medium">{template.name}</h3>
              <p className="mt-1 font-mono text-xs text-white/40">{template.key}</p>
              {template.description && <p className="mt-2 text-sm text-white/60">{template.description}</p>}
              <p className="mt-3 text-sm">
                {count} boutique{count > 1 ? 's' : ''} l&apos;utilise{count > 1 ? 'nt' : ''}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
