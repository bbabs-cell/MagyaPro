'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, cx, inputClass } from '@/components/ui';
import { DAY_NAMES } from '@/lib/site/hours';
import { ImageUploadField } from '@/components/dashboard/image-upload';
import { toMinor } from '@/lib/money';

/**
 * Assistant de configuration.
 *
 * Chaque étape enregistre immédiatement ses données par les mêmes routes que
 * le dashboard : rien n'est gardé en mémoire jusqu'à la fin, donc rien n'est
 * perdu si le restaurateur ferme son navigateur. L'étape atteinte est
 * elle-même persistée pour reprendre au bon endroit.
 */

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsappNumber: string | null;
  templateKey: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  currency: string;
};

type Hour = {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

const STEPS = [
  'Identité',
  'Coordonnées',
  'Horaires',
  'Réseaux sociaux',
  'Template',
  'Menu',
] as const;

export function OnboardingWizard({
  initialStep,
  restaurant: initialRestaurant,
  hours: initialHours,
  categories: initialCategories,
  productCount: initialProductCount,
  templates,
}: {
  initialStep: number;
  restaurant: Restaurant;
  hours: Hour[];
  categories: Array<{ id: string; name: string }>;
  productCount: number;
  templates: Array<{
    key: string;
    name: string;
    description: string | null;
    suggested: { primary: string; secondary: string } | null;
  }>;
}) {
  const router = useRouter();

  const [step, setStep] = useState(Math.min(initialStep, STEPS.length - 1));
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [hours, setHours] = useState(initialHours);
  const [categories, setCategories] = useState(initialCategories);
  const [productCount, setProductCount] = useState(initialProductCount);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function persistStep(nextStep: number) {
    await api.patch('/api/restaurant/onboarding', { step: nextStep }).catch(() => {
      // La progression est un confort : son échec ne doit pas bloquer
      // l'utilisateur qui vient de saisir ses données avec succès.
    });
  }

  /** Enveloppe commune : état de chargement, erreurs, avancement. */
  async function run(action: () => Promise<void>, advance = true) {
    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      await action();
      if (advance) {
        const next = Math.min(step + 1, STEPS.length - 1);
        setStep(next);
        void persistStep(next);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Une erreur inattendue s'est produite. Réessayez.");
      }
    } finally {
      setPending(false);
    }
  }

  // --- Étapes ---------------------------------------------------------------

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await run(async () => {
      const payload = {
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        phone: restaurant.phone ?? '',
        email: restaurant.email ?? '',
        addressLine: restaurant.addressLine ?? '',
        city: restaurant.city ?? '',
        country: restaurant.country ?? '',
      };
      const result = await api.patch<{ restaurant: Restaurant }>(
        '/api/restaurant',
        payload,
      );
      setRestaurant((current) => ({ ...current, ...result.restaurant }));
    });
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await run(async () => {
      const result = await api.patch<{ restaurant: Restaurant }>('/api/restaurant', {
        name: restaurant.name,
        description: restaurant.description ?? '',
        phone: String(formData.get('phone') ?? ''),
        email: String(formData.get('email') ?? ''),
        addressLine: String(formData.get('addressLine') ?? ''),
        city: String(formData.get('city') ?? ''),
        country: String(formData.get('country') ?? ''),
      });
      setRestaurant((current) => ({ ...current, ...result.restaurant }));
    });
  }

  async function saveHours() {
    await run(async () => {
      await api.put('/api/restaurant/horaires', { hours });
    });
  }

  async function saveSocials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await run(async () => {
      const result = await api.patch<{ restaurant: Restaurant }>('/api/restaurant', {
        name: restaurant.name,
        description: restaurant.description ?? '',
        phone: restaurant.phone ?? '',
        email: restaurant.email ?? '',
        addressLine: restaurant.addressLine ?? '',
        city: restaurant.city ?? '',
        country: restaurant.country ?? '',
        facebookUrl: String(formData.get('facebookUrl') ?? ''),
        instagramUrl: String(formData.get('instagramUrl') ?? ''),
        tiktokUrl: String(formData.get('tiktokUrl') ?? ''),
        whatsappNumber: String(formData.get('whatsappNumber') ?? ''),
      });
      setRestaurant((current) => ({ ...current, ...result.restaurant }));
    });
  }

  async function saveTemplate(templateKey: string) {
    const suggested = templates.find((t) => t.key === templateKey)?.suggested;

    await run(async () => {
      const result = await api.patch<{ restaurant: Restaurant }>(
        '/api/restaurant/apparence',
        {
          templateKey,
          primaryColor: suggested?.primary ?? restaurant.primaryColor,
          secondaryColor: suggested?.secondary ?? restaurant.secondaryColor,
          fontFamily: restaurant.fontFamily,
          logoUrl: restaurant.logoUrl,
        },
      );
      setRestaurant((current) => ({ ...current, ...result.restaurant }));
    });
  }

  async function addCategory(name: string) {
    await run(async () => {
      const result = await api.post<{ category: { id: string; name: string } }>(
        '/api/menu/categories',
        { name, isActive: true },
      );
      setCategories((current) => [...current, result.category]);
    }, false);
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await run(async () => {
      await api.post('/api/menu/produits', {
        categoryId: String(formData.get('categoryId') ?? ''),
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        price: toMinor(String(formData.get('price') ?? '0'), restaurant.currency),
        isAvailable: true,
        badge: 'NONE',
        variants: [],
        optionGroups: [],
      });
      setProductCount((count) => count + 1);
      form.reset();
    }, false);
  }

  async function finish() {
    await run(async () => {
      await api.patch('/api/restaurant/onboarding', {
        step: STEPS.length - 1,
        complete: true,
      });
      router.replace('/dashboard');
      router.refresh();
    }, false);
  }

  function goBack() {
    const previous = Math.max(0, step - 1);
    setStep(previous);
    setError(null);
    void persistStep(previous);
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configurons votre restaurant
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Vos réponses sont enregistrées au fur et à mesure. Vous pourrez tout
          modifier plus tard.
        </p>
      </header>

      {/* Progression : `aria-current` porte l'étape active pour les lecteurs
          d'écran, la couleur ne suffit pas. */}
      <nav aria-label="Progression" className="mb-6">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((label, index) => (
            <li key={label} className="flex-1">
              <span
                aria-current={index === step ? 'step' : undefined}
                className={cx(
                  'block rounded-full px-2 py-1 text-center text-[11px] font-medium transition-colors',
                  index < step && 'bg-emerald-100 text-emerald-800',
                  index === step && 'bg-ink text-white',
                  index > step && 'bg-white text-ink-faint',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-faint">
          Étape {step + 1} sur {STEPS.length}
        </p>
      </nav>

      <div className="card p-5 sm:p-6">
        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* ------------------------------------------------------- Identité */}
        {step === 0 && (
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <h2 className="text-lg font-medium">Votre identité</h2>

            <Field label="Nom du restaurant" htmlFor="name" required error={fieldErrors.name}>
              <input
                id="name"
                name="name"
                defaultValue={restaurant.name}
                required
                className={inputClass}
              />
            </Field>

            <ImageUploadField
              label="Logo"
              folder="logos"
              value={restaurant.logoUrl}
              hint="Carré de préférence. JPEG, PNG, WebP ou AVIF, 5 Mo maximum."
              onChange={async (url) => {
                setRestaurant((current) => ({ ...current, logoUrl: url }));
                await api
                  .patch('/api/restaurant/apparence', {
                    templateKey: restaurant.templateKey,
                    primaryColor: restaurant.primaryColor,
                    secondaryColor: restaurant.secondaryColor,
                    fontFamily: restaurant.fontFamily,
                    logoUrl: url,
                  })
                  .catch(() => undefined);
              }}
            />

            <Field
              label="Description"
              htmlFor="description"
              hint="Une ou deux phrases qui donnent envie."
              error={fieldErrors.description}
            >
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={restaurant.description ?? ''}
                className={inputClass}
                placeholder="Cuisine maison, produits frais, spécialités grillées."
              />
            </Field>

            <div className="rounded-xl bg-surface-sunken px-4 py-3 text-sm">
              <p className="text-ink-muted">Adresse de votre site :</p>
              <p className="mt-0.5 font-mono text-ink">{restaurant.slug}</p>
            </div>

            <StepActions pending={pending} canGoBack={false} onBack={goBack} />
          </form>
        )}

        {/* ----------------------------------------------------- Coordonnées */}
        {step === 1 && (
          <form onSubmit={saveContact} className="space-y-4" noValidate>
            <h2 className="text-lg font-medium">Vos coordonnées</h2>

            <Field label="Téléphone" htmlFor="phone" error={fieldErrors.phone}>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={restaurant.phone ?? ''}
                className={inputClass}
                placeholder="+225 07 00 00 00 00"
              />
            </Field>

            <Field
              label="Email de contact"
              htmlFor="email"
              hint="Vous y recevrez les notifications de commande."
              error={fieldErrors.email}
            >
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={restaurant.email ?? ''}
                className={inputClass}
              />
            </Field>

            <Field label="Adresse" htmlFor="addressLine" error={fieldErrors.addressLine}>
              <input
                id="addressLine"
                name="addressLine"
                defaultValue={restaurant.addressLine ?? ''}
                className={inputClass}
                placeholder="Rue, quartier"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ville" htmlFor="city" error={fieldErrors.city}>
                <input
                  id="city"
                  name="city"
                  defaultValue={restaurant.city ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Pays" htmlFor="country" error={fieldErrors.country}>
                <input
                  id="country"
                  name="country"
                  defaultValue={restaurant.country ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>

            <StepActions pending={pending} canGoBack onBack={goBack} />
          </form>
        )}

        {/* -------------------------------------------------------- Horaires */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Vos horaires</h2>
            <p className="text-sm text-ink-muted">
              Ils déterminent l&apos;indicateur « ouvert / fermé » sur votre site.
            </p>

            <div className="space-y-2">
              {hours.map((hour) => (
                <div
                  key={hour.dayOfWeek}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-border p-3"
                >
                  <span className="w-24 text-sm font-medium">
                    {DAY_NAMES[hour.dayOfWeek]}
                  </span>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!hour.isClosed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((row) =>
                            row.dayOfWeek === hour.dayOfWeek
                              ? { ...row, isClosed: !event.target.checked }
                              : row,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-ink"
                    />
                    Ouvert
                  </label>

                  {!hour.isClosed && (
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`opens-${hour.dayOfWeek}`}>
                        Heure d&apos;ouverture {DAY_NAMES[hour.dayOfWeek]}
                      </label>
                      <input
                        id={`opens-${hour.dayOfWeek}`}
                        type="time"
                        value={hour.opensAt}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((row) =>
                              row.dayOfWeek === hour.dayOfWeek
                                ? { ...row, opensAt: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="rounded-lg border border-surface-border px-2 py-1.5 text-sm"
                      />
                      <span aria-hidden="true" className="text-ink-faint">–</span>
                      <label className="sr-only" htmlFor={`closes-${hour.dayOfWeek}`}>
                        Heure de fermeture {DAY_NAMES[hour.dayOfWeek]}
                      </label>
                      <input
                        id={`closes-${hour.dayOfWeek}`}
                        type="time"
                        value={hour.closesAt}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((row) =>
                              row.dayOfWeek === hour.dayOfWeek
                                ? { ...row, closesAt: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="rounded-lg border border-surface-border px-2 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <StepActions pending={pending} canGoBack onBack={goBack} onNext={saveHours} />
          </div>
        )}

        {/* -------------------------------------------------- Réseaux sociaux */}
        {step === 3 && (
          <form onSubmit={saveSocials} className="space-y-4" noValidate>
            <h2 className="text-lg font-medium">Vos réseaux sociaux</h2>
            <p className="text-sm text-ink-muted">
              Facultatif. Ces liens apparaîtront sur la page Informations.
            </p>

            <Field label="Facebook" htmlFor="facebookUrl" error={fieldErrors.facebookUrl}>
              <input
                id="facebookUrl"
                name="facebookUrl"
                type="url"
                defaultValue={restaurant.facebookUrl ?? ''}
                className={inputClass}
                placeholder="https://facebook.com/votre-page"
              />
            </Field>

            <Field label="Instagram" htmlFor="instagramUrl" error={fieldErrors.instagramUrl}>
              <input
                id="instagramUrl"
                name="instagramUrl"
                type="url"
                defaultValue={restaurant.instagramUrl ?? ''}
                className={inputClass}
                placeholder="https://instagram.com/votre-compte"
              />
            </Field>

            <Field label="TikTok" htmlFor="tiktokUrl" error={fieldErrors.tiktokUrl}>
              <input
                id="tiktokUrl"
                name="tiktokUrl"
                type="url"
                defaultValue={restaurant.tiktokUrl ?? ''}
                className={inputClass}
              />
            </Field>

            <Field
              label="Numéro WhatsApp"
              htmlFor="whatsappNumber"
              error={fieldErrors.whatsappNumber}
            >
              <input
                id="whatsappNumber"
                name="whatsappNumber"
                type="tel"
                defaultValue={restaurant.whatsappNumber ?? ''}
                className={inputClass}
              />
            </Field>

            <StepActions pending={pending} canGoBack onBack={goBack} />
          </form>
        )}

        {/* -------------------------------------------------------- Template */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Choisissez un template</h2>
            <p className="text-sm text-ink-muted">
              Vous pourrez en changer à tout moment sans perdre vos données.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() =>
                    setRestaurant((current) => ({ ...current, templateKey: template.key }))
                  }
                  aria-pressed={restaurant.templateKey === template.key}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition-colors',
                    restaurant.templateKey === template.key
                      ? 'border-ink ring-1 ring-ink'
                      : 'border-surface-border hover:border-ink',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="mb-3 block h-16 rounded-lg"
                    style={{
                      backgroundColor: template.suggested?.primary ?? '#12151a',
                    }}
                  />
                  <span className="block font-medium">{template.name}</span>
                  {template.description && (
                    <span className="mt-1 block text-sm text-ink-muted">
                      {template.description}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <StepActions
              pending={pending}
              canGoBack
              onBack={goBack}
              onNext={() => saveTemplate(restaurant.templateKey)}
            />
          </div>
        )}

        {/* ------------------------------------------------------------ Menu */}
        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium">Vos premiers plats</h2>
            <p className="text-sm text-ink-muted">
              Créez au moins une catégorie et un plat. Vous compléterez votre
              carte tranquillement depuis votre tableau de bord.
            </p>

            <section>
              <h3 className="text-sm font-medium">Catégories</h3>
              {categories.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="rounded-lg bg-surface-sunken px-3 py-1.5 text-sm"
                    >
                      {category.name}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {['Entrées', 'Plats', 'Grillades', 'Burgers', 'Desserts', 'Boissons']
                  .filter((name) => !categories.some((category) => category.name === name))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={pending}
                      onClick={() => addCategory(name)}
                      className="rounded-lg border border-dashed border-surface-border px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink disabled:opacity-50"
                    >
                      + {name}
                    </button>
                  ))}
              </div>
            </section>

            {categories.length > 0 && (
              <form onSubmit={addProduct} className="space-y-4 border-t border-surface-border pt-5" noValidate>
                <h3 className="text-sm font-medium">Ajouter un plat</h3>

                <Field label="Catégorie" htmlFor="categoryId" required>
                  <select id="categoryId" name="categoryId" required className={inputClass}>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nom du plat" htmlFor="product-name" required error={fieldErrors.name}>
                  <input
                    id="product-name"
                    name="name"
                    required
                    className={inputClass}
                    placeholder="Poulet braisé"
                  />
                </Field>

                <Field label="Description" htmlFor="product-description">
                  <input
                    id="product-description"
                    name="description"
                    className={inputClass}
                    placeholder="Accompagné d'attiéké et de sauce piquante"
                  />
                </Field>

                <Field
                  label={`Prix (${restaurant.currency})`}
                  htmlFor="price"
                  required
                  error={fieldErrors.price}
                >
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="any"
                    required
                    className={inputClass}
                    placeholder="3000"
                  />
                </Field>

                <Button type="submit" variant="secondary" disabled={pending}>
                  {pending ? 'Ajout…' : 'Ajouter ce plat'}
                </Button>

                {productCount > 0 && (
                  <p role="status" className="text-sm text-emerald-700">
                    {productCount} plat{productCount > 1 ? 's' : ''} enregistré
                    {productCount > 1 ? 's' : ''}.
                  </p>
                )}
              </form>
            )}

            <div className="flex flex-col gap-2 border-t border-surface-border pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={goBack} disabled={pending}>
                Retour
              </Button>
              <Button
                type="button"
                onClick={finish}
                disabled={pending || productCount === 0}
                size="lg"
              >
                {pending ? 'Finalisation…' : 'Terminer la configuration'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepActions({
  pending,
  canGoBack,
  onBack,
  onNext,
}: {
  pending: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={!canGoBack || pending}
      >
        Retour
      </Button>
      <Button
        type={onNext ? 'button' : 'submit'}
        onClick={onNext}
        disabled={pending}
        size="lg"
      >
        {pending ? 'Enregistrement…' : 'Continuer'}
      </Button>
    </div>
  );
}
