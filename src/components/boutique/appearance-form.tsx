'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Card, Field, cx, inputClass } from '@/components/ui';
import { ImageUploadField } from '@/components/boutique/image-upload-field';

const FONTS = [
  'Inter',
  'Poppins',
  'DM Sans',
  'Space Grotesk',
  'Playfair Display',
] as const;

export type StoreTemplateOption = {
  key: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
};

/**
 * Identité visuelle du site public de la boutique — équivalent de
 * `AppearanceForm` (Restaurant), sans la section « chef » (propre au
 * template Restaurant « elegant », sans équivalent Boutique).
 */
export function AppearanceForm({
  store,
  templates,
}: {
  store: {
    slug: string;
    templateKey: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    logoUrl: string | null;
    coverUrl: string | null;
    faviconUrl: string | null;
  };
  templates: StoreTemplateOption[];
}) {
  const router = useRouter();

  const [templateKey, setTemplateKey] = useState(store.templateKey);
  const [primaryColor, setPrimaryColor] = useState(store.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(store.secondaryColor);
  const [logoUrl, setLogoUrl] = useState(store.logoUrl);
  const [coverUrl, setCoverUrl] = useState(store.coverUrl);
  const [faviconUrl, setFaviconUrl] = useState(store.faviconUrl);

  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function selectTemplate(template: StoreTemplateOption) {
    setTemplateKey(template.key);
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    try {
      await api.patch('/api/boutique/parametres/apparence', {
        templateKey,
        primaryColor,
        secondaryColor,
        fontFamily: String(formData.get('fontFamily') ?? 'Inter'),
        logoUrl,
        coverUrl,
        faviconUrl,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("L'apparence n'a pas pu être enregistrée.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Apparence enregistrée.{' '}
          <Link href={`/s/${store.slug}`} target="_blank" rel="noopener" className="font-medium underline underline-offset-4">
            Voir le résultat
          </Link>
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">Template</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Le template ne fait que présenter vos produits. En changer n&apos;affecte
          ni votre catalogue, ni vos ventes, ni vos clients.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => selectTemplate(template)}
              aria-pressed={templateKey === template.key}
              className={cx(
                'rounded-2xl border p-4 text-left transition-colors',
                templateKey === template.key
                  ? 'border-ink ring-1 ring-ink'
                  : 'border-surface-border hover:border-ink',
              )}
            >
              {template.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu de template, hôte de stockage arbitraire
                <img
                  src={template.previewImageUrl}
                  alt=""
                  className="mb-3 h-28 w-full rounded-lg object-cover"
                />
              ) : (
                <span aria-hidden="true" className="mb-3 block h-14 rounded-lg bg-[var(--brand,#12151a)]" />
              )}
              <span className="font-medium">{template.name}</span>
              {template.description && (
                <span className="mt-1 block text-sm text-ink-muted">
                  {template.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">Couleurs et typographie</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field
            label="Couleur principale"
            htmlFor="primaryColor"
            hint="Boutons, prix et accents."
            error={fieldErrors.primaryColor}
          >
            <div className="flex items-center gap-2">
              <input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(event) => {
                  setPrimaryColor(event.target.value);
                  setSaved(false);
                }}
                className="h-11 w-14 cursor-pointer rounded-lg border border-surface-border"
              />
              <span className="font-mono text-sm text-ink-muted">{primaryColor}</span>
            </div>
          </Field>

          <Field
            label="Couleur secondaire"
            htmlFor="secondaryColor"
            hint="Textes et fonds sombres."
            error={fieldErrors.secondaryColor}
          >
            <div className="flex items-center gap-2">
              <input
                id="secondaryColor"
                type="color"
                value={secondaryColor}
                onChange={(event) => {
                  setSecondaryColor(event.target.value);
                  setSaved(false);
                }}
                className="h-11 w-14 cursor-pointer rounded-lg border border-surface-border"
              />
              <span className="font-mono text-sm text-ink-muted">{secondaryColor}</span>
            </div>
          </Field>

          <Field label="Typographie" htmlFor="fontFamily">
            <select
              id="fontFamily"
              name="fontFamily"
              defaultValue={store.fontFamily}
              className={inputClass}
            >
              {FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-4 sm:p-5">
        <h2 className="text-sm font-medium">Images</h2>

        <ImageUploadField
          label="Logo"
          folder="logos"
          value={logoUrl}
          hint="Affiché dans l'en-tête du site. Format carré recommandé."
          onChange={(url) => {
            setLogoUrl(url);
            setSaved(false);
          }}
        />

        <ImageUploadField
          label="Image de couverture"
          folder="covers"
          value={coverUrl}
          hint="Grande image d'accueil (utilisée par certains templates). Format paysage, 1600 px de large minimum."
          onChange={(url) => {
            setCoverUrl(url);
            setSaved(false);
          }}
        />

        <ImageUploadField
          label="Favicon"
          folder="logos"
          value={faviconUrl}
          hint="Petite icône affichée dans l'onglet du navigateur."
          onChange={(url) => {
            setFaviconUrl(url);
            setSaved(false);
          }}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </Button>
        <Link
          href={`/s/${store.slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-12 items-center rounded-xl border border-surface-border bg-surface px-5 text-sm font-medium hover:bg-surface-sunken"
        >
          Prévisualiser le site
        </Link>
      </div>
    </form>
  );
}
