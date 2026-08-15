'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Badge, Button, Card, Field, cx, inputClass } from '@/components/ui';
import { ImageUploadField } from '@/components/dashboard/image-upload';

const FONTS = [
  'Inter',
  'Poppins',
  'DM Sans',
  'Space Grotesk',
  'Playfair Display',
] as const;

type Template = {
  key: string;
  name: string;
  description: string | null;
  isPremium: boolean;
  locked: boolean;
  suggested: { primary: string; secondary: string } | null;
  previewImageUrl: string | null;
};

/**
 * Identité visuelle du site public.
 *
 * Les couleurs sont saisies via un sélecteur natif, ce qui garantit un format
 * `#RRGGBB` — le serveur le revalide de toute façon, puisqu'elles finissent
 * injectées dans des variables CSS.
 */
export function AppearanceForm({
  restaurant,
  templates,
}: {
  restaurant: {
    slug: string;
    templateKey: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    logoUrl: string | null;
    coverUrl: string | null;
    faviconUrl: string | null;
    chefName: string | null;
    chefBio: string | null;
    chefPhoto: string | null;
  };
  templates: Template[];
}) {
  const router = useRouter();

  const [templateKey, setTemplateKey] = useState(restaurant.templateKey);
  const [primaryColor, setPrimaryColor] = useState(restaurant.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(restaurant.secondaryColor);
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl);
  const [coverUrl, setCoverUrl] = useState(restaurant.coverUrl);
  const [faviconUrl, setFaviconUrl] = useState(restaurant.faviconUrl);
  const [chefName, setChefName] = useState(restaurant.chefName ?? '');
  const [chefBio, setChefBio] = useState(restaurant.chefBio ?? '');
  const [chefPhoto, setChefPhoto] = useState(restaurant.chefPhoto);

  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function selectTemplate(template: Template) {
    if (template.locked) return;
    setTemplateKey(template.key);
    setSaved(false);

    // Adopter la palette suggérée uniquement si le restaurateur n'a pas déjà
    // personnalisé la sienne : on ne veut pas écraser un choix délibéré.
    if (template.suggested && primaryColor === restaurant.primaryColor) {
      setPrimaryColor(template.suggested.primary);
      setSecondaryColor(template.suggested.secondary);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    try {
      await api.patch('/api/restaurant/apparence', {
        templateKey,
        primaryColor,
        secondaryColor,
        fontFamily: String(formData.get('fontFamily') ?? 'Inter'),
        logoUrl,
        coverUrl,
        faviconUrl,
        chefName,
        chefBio,
        chefPhoto,
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
          <Link
            href={`/r/${restaurant.slug}`}
            className="font-medium underline underline-offset-4"
          >
            Voir le résultat
          </Link>
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">Template</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Le template ne fait que présenter vos données. En changer n&apos;affecte
          ni votre menu, ni vos commandes, ni vos clients.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => selectTemplate(template)}
              disabled={template.locked}
              aria-pressed={templateKey === template.key}
              className={cx(
                'rounded-2xl border p-4 text-left transition-colors',
                templateKey === template.key
                  ? 'border-ink ring-1 ring-ink'
                  : 'border-surface-border hover:border-ink',
                template.locked && 'cursor-not-allowed opacity-60 hover:border-surface-border',
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
                <span
                  aria-hidden="true"
                  className="mb-3 block h-14 rounded-lg"
                  style={{ backgroundColor: template.suggested?.primary ?? '#12151a' }}
                />
              )}
              <span className="flex items-center gap-2 font-medium">
                {template.name}
                {template.isPremium && <Badge tone="brand">Premium</Badge>}
              </span>
              {template.description && (
                <span className="mt-1 block text-sm text-ink-muted">
                  {template.description}
                </span>
              )}
              {template.locked && (
                <span className="mt-2 block text-xs text-ink-faint">
                  Inclus dans les plans supérieurs
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {templateKey === 'elegant' && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Le chef</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Affiché dans une section dédiée du template Élégant. Laissez le nom
            vide pour ne pas afficher cette section.
          </p>

          <div className="mt-4 space-y-4">
            <ImageUploadField
              label="Photo du chef"
              folder="chef"
              value={chefPhoto}
              onChange={(url) => setChefPhoto(url)}
            />
            <Field label="Nom du chef" htmlFor="chefName" error={fieldErrors.chefName}>
              <input
                id="chefName"
                value={chefName}
                onChange={(event) => setChefName(event.target.value)}
                className={inputClass}
                placeholder="Chef Aïcha Traoré"
              />
            </Field>
            <Field
              label="Présentation"
              htmlFor="chefBio"
              hint="Quelques phrases : parcours, spécialité, philosophie de cuisine."
              error={fieldErrors.chefBio}
            >
              <textarea
                id="chefBio"
                value={chefBio}
                onChange={(event) => setChefBio(event.target.value)}
                rows={4}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-medium">Couleurs et typographie</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field
            label="Couleur principale"
            htmlFor="primaryColor"
            hint="Boutons et accents."
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
              defaultValue={restaurant.fontFamily}
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
          hint="Grande image d'accueil. Format paysage, 1600 px de large minimum."
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
          href={`/r/${restaurant.slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-12 items-center rounded-xl border border-surface-border bg-white px-5 text-sm font-medium hover:bg-surface-sunken"
        >
          Prévisualiser le site
        </Link>
      </div>
    </form>
  );
}
