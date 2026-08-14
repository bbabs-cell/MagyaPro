'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { toMajor, toMinor } from '@/lib/money';
import { DAY_NAMES } from '@/lib/site/hours';
import { Badge, Button, Card, Field, cx, inputClass } from '@/components/ui';
import { ImageUploadField } from '@/components/dashboard/image-upload';
import { SoundUploadField } from '@/components/dashboard/sound-upload';

/**
 * Réglages du restaurant, regroupés par sujet.
 *
 * Chaque panneau enregistre indépendamment : un restaurateur qui corrige son
 * numéro de téléphone n'a pas à repasser sur ses horaires.
 */

type Restaurant = {
  id: string;
  slug: string;
  status: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsappNumber: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageUrl: string | null;
  currency: string;
};

type Settings = {
  orderingEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  tableOrderingEnabled: boolean;
  minOrderAmount: number;
  prepTimeMinutes: number;
  paymentProviders: string[];
  orangeMoneyNumber: string | null;
  waveNumber: string | null;
  notificationEmail: string | null;
  notificationSoundUrl: string | null;
};

type Hour = { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string };

type Domain = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  verificationToken: string;
  recordName: string;
};

const TABS = [
  { key: 'profil', label: 'Informations' },
  { key: 'horaires', label: 'Horaires' },
  { key: 'commandes', label: 'Commandes' },
  { key: 'seo', label: 'Référencement' },
  { key: 'domaines', label: 'Domaines' },
  { key: 'publication', label: 'Publication' },
  { key: 'sauvegarde', label: 'Sauvegarde' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SettingsPanels({
  restaurant,
  settings,
  hours: initialHours,
  providers,
  domains,
  cnameTarget,
  canPublish,
  customDomainAllowed,
}: {
  restaurant: Restaurant;
  settings: Settings;
  hours: Hour[];
  providers: Array<{ id: string; label: string; description: string; available: boolean }>;
  domains: Domain[];
  cnameTarget: string;
  canPublish: boolean;
  customDomainAllowed: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('profil');
  const [hours, setHours] = useState(initialHours);
  const [selectedProviders, setSelectedProviders] = useState(settings.paymentProviders);
  const [seoImageUrl, setSeoImageUrl] = useState(restaurant.seoImageUrl);
  const [notificationSoundUrl, setNotificationSoundUrl] = useState(settings.notificationSoundUrl);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(action: () => Promise<void>, successMessage: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    try {
      await action();
      setMessage(successMessage);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("L'enregistrement a échoué. Réessayez.");
      }
    } finally {
      setPending(false);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const lat = String(formData.get('latitude') ?? '').trim();
    const lng = String(formData.get('longitude') ?? '').trim();

    void submit(async () => {
      await api.patch('/api/restaurant', {
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        email: String(formData.get('email') ?? ''),
        addressLine: String(formData.get('addressLine') ?? ''),
        city: String(formData.get('city') ?? ''),
        country: String(formData.get('country') ?? ''),
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        facebookUrl: String(formData.get('facebookUrl') ?? ''),
        instagramUrl: String(formData.get('instagramUrl') ?? ''),
        tiktokUrl: String(formData.get('tiktokUrl') ?? ''),
        whatsappNumber: String(formData.get('whatsappNumber') ?? ''),
      });
    }, 'Informations enregistrées.');
  }

  function saveHours() {
    void submit(async () => {
      await api.put('/api/restaurant/horaires', { hours });
    }, 'Horaires enregistrés.');
  }

  function saveOrdering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void submit(async () => {
      await api.patch('/api/restaurant/reglages', {
        orderingEnabled: formData.get('orderingEnabled') === 'on',
        deliveryEnabled: formData.get('deliveryEnabled') === 'on',
        pickupEnabled: formData.get('pickupEnabled') === 'on',
        tableOrderingEnabled: formData.get('tableOrderingEnabled') === 'on',
        minOrderAmount: toMinor(
          String(formData.get('minOrderAmount') ?? '0'),
          restaurant.currency,
        ),
        prepTimeMinutes: Number(formData.get('prepTimeMinutes') ?? 30),
        paymentProviders: selectedProviders,
        orangeMoneyNumber: String(formData.get('orangeMoneyNumber') ?? ''),
        waveNumber: String(formData.get('waveNumber') ?? ''),
        notificationEmail: String(formData.get('notificationEmail') ?? ''),
      });
    }, 'Réglages de commande enregistrés.');
  }

  function saveSeo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void submit(async () => {
      await api.put('/api/restaurant/reglages', {
        seoTitle: String(formData.get('seoTitle') ?? ''),
        seoDescription: String(formData.get('seoDescription') ?? ''),
        seoImageUrl,
      });
    }, 'Référencement enregistré.');
  }

  function togglePublication(published: boolean) {
    void submit(async () => {
      await api.post('/api/restaurant/publier', { published });
    }, published ? 'Votre site est en ligne.' : 'Votre site est hors ligne.');
  }

  return (
    <div>
      <nav aria-label="Sections des réglages" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setMessage(null);
              setError(null);
            }}
            aria-current={tab === item.key ? 'true' : undefined}
            className={cx(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors',
              tab === item.key ? 'bg-ink text-white' : 'bg-white text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {/* ----------------------------------------------------- Informations */}
      {tab === 'profil' && (
        <Card className="p-4 sm:p-5">
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <Field label="Nom du restaurant" htmlFor="name" required error={fieldErrors.name}>
              <input
                id="name"
                name="name"
                required
                defaultValue={restaurant.name}
                className={inputClass}
              />
            </Field>

            <Field label="Description" htmlFor="description" error={fieldErrors.description}>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={restaurant.description ?? ''}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone" htmlFor="phone" error={fieldErrors.phone}>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={restaurant.phone ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" htmlFor="email" error={fieldErrors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={restaurant.email ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Adresse" htmlFor="addressLine" error={fieldErrors.addressLine}>
              <input
                id="addressLine"
                name="addressLine"
                defaultValue={restaurant.addressLine ?? ''}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ville" htmlFor="city">
                <input
                  id="city"
                  name="city"
                  defaultValue={restaurant.city ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Pays" htmlFor="country">
                <input
                  id="country"
                  name="country"
                  defaultValue={restaurant.country ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Latitude"
                htmlFor="latitude"
                hint="Facultatif. Utilisée pour le lien vers la carte."
                error={fieldErrors.latitude}
              >
                <input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  defaultValue={restaurant.latitude ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Longitude" htmlFor="longitude" error={fieldErrors.longitude}>
                <input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  defaultValue={restaurant.longitude ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Réseaux sociaux</legend>
              <Field label="Facebook" htmlFor="facebookUrl" error={fieldErrors.facebookUrl}>
                <input
                  id="facebookUrl"
                  name="facebookUrl"
                  type="url"
                  defaultValue={restaurant.facebookUrl ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Instagram" htmlFor="instagramUrl" error={fieldErrors.instagramUrl}>
                <input
                  id="instagramUrl"
                  name="instagramUrl"
                  type="url"
                  defaultValue={restaurant.instagramUrl ?? ''}
                  className={inputClass}
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
              <Field label="WhatsApp" htmlFor="whatsappNumber" error={fieldErrors.whatsappNumber}>
                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="tel"
                  defaultValue={restaurant.whatsappNumber ?? ''}
                  className={inputClass}
                />
              </Field>
            </fieldset>

            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </Card>
      )}

      {/* ---------------------------------------------------------- Horaires */}
      {tab === 'horaires' && (
        <Card className="p-4 sm:p-5">
          <div className="space-y-2">
            {hours.map((hour) => (
              <div
                key={hour.dayOfWeek}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-border p-3"
              >
                <span className="w-24 text-sm font-medium">{DAY_NAMES[hour.dayOfWeek]}</span>

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
                    <label className="sr-only" htmlFor={`o-${hour.dayOfWeek}`}>
                      Ouverture {DAY_NAMES[hour.dayOfWeek]}
                    </label>
                    <input
                      id={`o-${hour.dayOfWeek}`}
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
                    <label className="sr-only" htmlFor={`c-${hour.dayOfWeek}`}>
                      Fermeture {DAY_NAMES[hour.dayOfWeek]}
                    </label>
                    <input
                      id={`c-${hour.dayOfWeek}`}
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

          <Button type="button" onClick={saveHours} disabled={pending} className="mt-4">
            {pending ? 'Enregistrement…' : 'Enregistrer les horaires'}
          </Button>
        </Card>
      )}

      {/* --------------------------------------------------------- Commandes */}
      {tab === 'commandes' && (
        <Card className="p-4 sm:p-5">
          <form onSubmit={saveOrdering} className="space-y-5" noValidate>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="orderingEnabled"
                  defaultChecked={settings.orderingEnabled}
                  className="h-4 w-4 accent-ink"
                />
                Accepter les commandes en ligne
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="deliveryEnabled"
                  defaultChecked={settings.deliveryEnabled}
                  className="h-4 w-4 accent-ink"
                />
                Proposer la livraison
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="pickupEnabled"
                  defaultChecked={settings.pickupEnabled}
                  className="h-4 w-4 accent-ink"
                />
                Proposer le retrait sur place
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="tableOrderingEnabled"
                  defaultChecked={settings.tableOrderingEnabled}
                  className="h-4 w-4 accent-ink"
                />
                Autoriser la commande autonome depuis les tables (QR code)
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`Montant minimum (${restaurant.currency})`}
                htmlFor="minOrderAmount"
                hint="0 = aucun minimum"
                error={fieldErrors.minOrderAmount}
              >
                <input
                  id="minOrderAmount"
                  name="minOrderAmount"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={toMajor(settings.minOrderAmount, restaurant.currency)}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Temps de préparation (minutes)"
                htmlFor="prepTimeMinutes"
                error={fieldErrors.prepTimeMinutes}
              >
                <input
                  id="prepTimeMinutes"
                  name="prepTimeMinutes"
                  type="number"
                  min="0"
                  max="600"
                  defaultValue={settings.prepTimeMinutes}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="Email de notification"
              htmlFor="notificationEmail"
              hint="Adresse recevant les nouvelles commandes. Par défaut, l'email du restaurant."
              error={fieldErrors.notificationEmail}
            >
              <input
                id="notificationEmail"
                name="notificationEmail"
                type="email"
                defaultValue={settings.notificationEmail ?? ''}
                className={inputClass}
              />
            </Field>

            <SoundUploadField value={notificationSoundUrl} onChange={setNotificationSoundUrl} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Numéro Orange Money"
                htmlFor="orangeMoneyNumber"
                hint="Requis pour activer le dépôt manuel Orange Money."
                error={fieldErrors.orangeMoneyNumber}
              >
                <input
                  id="orangeMoneyNumber"
                  name="orangeMoneyNumber"
                  defaultValue={settings.orangeMoneyNumber ?? ''}
                  className={inputClass}
                  placeholder="07 00 00 00 00"
                />
              </Field>
              <Field
                label="Numéro Wave"
                htmlFor="waveNumber"
                hint="Requis pour activer le dépôt manuel Wave."
                error={fieldErrors.waveNumber}
              >
                <input
                  id="waveNumber"
                  name="waveNumber"
                  defaultValue={settings.waveNumber ?? ''}
                  className={inputClass}
                  placeholder="07 00 00 00 00"
                />
              </Field>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Moyens de paiement</legend>
              <p className="mt-1 text-xs text-ink-muted">
                Seuls les moyens réellement opérationnels sur cette instance
                peuvent être activés.
              </p>

              <div className="mt-3 space-y-1.5">
                {providers.map((provider) => (
                  <label
                    key={provider.id}
                    className={cx(
                      'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
                      provider.available
                        ? 'cursor-pointer border-surface-border hover:border-ink'
                        : 'cursor-not-allowed border-surface-border bg-surface-sunken opacity-70',
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={!provider.available}
                      checked={selectedProviders.includes(provider.id)}
                      onChange={(event) =>
                        setSelectedProviders((current) =>
                          event.target.checked
                            ? [...current, provider.id]
                            : current.filter((id) => id !== provider.id),
                        )
                      }
                      className="mt-0.5 h-4 w-4 accent-ink"
                    />
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        {provider.label}
                        {!provider.available && (
                          <Badge tone="neutral">Non configuré</Badge>
                        )}
                      </span>
                      <span className="block text-ink-muted">{provider.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </Card>
      )}

      {/* ------------------------------------------------------ Référencement */}
      {tab === 'seo' && (
        <Card className="p-4 sm:p-5">
          <form onSubmit={saveSeo} className="space-y-4" noValidate>
            <p className="text-sm text-ink-muted">
              Ces informations apparaissent dans les résultats de recherche et
              lors du partage de votre site sur les réseaux sociaux.
            </p>

            <Field
              label="Titre"
              htmlFor="seoTitle"
              hint="70 caractères maximum. Vide = nom du restaurant."
              error={fieldErrors.seoTitle}
            >
              <input
                id="seoTitle"
                name="seoTitle"
                maxLength={70}
                defaultValue={restaurant.seoTitle ?? ''}
                className={inputClass}
                placeholder={restaurant.name}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="seoDescription"
              hint="160 à 180 caractères. Vide = description du restaurant."
              error={fieldErrors.seoDescription}
            >
              <textarea
                id="seoDescription"
                name="seoDescription"
                rows={3}
                maxLength={180}
                defaultValue={restaurant.seoDescription ?? ''}
                className={inputClass}
              />
            </Field>

            <ImageUploadField
              label="Image de partage"
              folder="seo"
              value={seoImageUrl}
              hint="Affichée quand votre lien est partagé. 1200 × 630 px recommandé."
              onChange={setSeoImageUrl}
            />

            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </Card>
      )}

      {/* ---------------------------------------------------------- Domaines */}
      {tab === 'domaines' && (
        <DomainsPanel
          domains={domains}
          cnameTarget={cnameTarget}
          allowed={customDomainAllowed}
        />
      )}

      {/* -------------------------------------------------------- Publication */}
      {tab === 'publication' && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">État de publication</h2>

          <p className="mt-3 flex items-center gap-2 text-sm">
            {restaurant.status === 'ACTIVE' ? (
              <>
                <Badge tone="success">En ligne</Badge>
                <span className="text-ink-muted">
                  Votre site est accessible à vos clients.
                </span>
              </>
            ) : restaurant.status === 'SUSPENDED' ? (
              <>
                <Badge tone="danger">Suspendu</Badge>
                <span className="text-ink-muted">
                  Contactez le support Magyapro pour réactiver votre restaurant.
                </span>
              </>
            ) : (
              <>
                <Badge tone="neutral">Brouillon</Badge>
                <span className="text-ink-muted">
                  Votre site n&apos;est pas encore visible du public.
                </span>
              </>
            )}
          </p>

          <p className="mt-4 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
            Adresse publique :{' '}
            <span className="font-mono">{restaurant.slug}</span>
          </p>

          {canPublish && restaurant.status !== 'SUSPENDED' && (
            <div className="mt-5">
              {restaurant.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => togglePublication(false)}
                >
                  {pending ? 'Traitement…' : 'Mettre le site hors ligne'}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  disabled={pending}
                  onClick={() => togglePublication(true)}
                >
                  {pending ? 'Publication…' : 'Publier mon site'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'sauvegarde' && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-medium">Export complet</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Téléchargez l&apos;intégralité des données de votre restaurant au
            format JSON : profil, réglages, menu, promotions, fidélité,
            tables, zones de livraison, clients et commandes. À conserver
            comme sauvegarde, ou pour partir avec vos données.
          </p>
          <a
            href="/api/sauvegarde"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
          >
            Télécharger la sauvegarde (JSON)
          </a>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- Domaines

function DomainsPanel({
  domains,
  cnameTarget,
  allowed,
}: {
  domains: Domain[];
  cnameTarget: string;
  allowed: boolean;
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
    setDetail(null);

    try {
      await api.post('/api/domaines', {
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
        `/api/domaines/${domain.id}`,
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
      await api.delete(`/api/domaines/${domain.id}`);
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
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => verify(domain)}
                  >
                    Vérifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(domain)}
                  >
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
                  <span className="font-mono break-all">{domain.recordName}</span> avec la
                  valeur{' '}
                  <span className="font-mono break-all">{domain.verificationToken}</span>
                </p>
                <p>
                  2. Enregistrement <span className="font-mono">CNAME</span> de{' '}
                  <span className="font-mono">{domain.hostname}</span> vers{' '}
                  <span className="font-mono">{cnameTarget}</span>
                </p>
                <p className="text-ink-muted">
                  La propagation DNS peut prendre jusqu&apos;à 24 heures. Le
                  certificat TLS est émis automatiquement une fois le domaine
                  vérifié.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {allowed ? (
        <form onSubmit={addDomain} className="mt-5 flex flex-wrap gap-2">
          <label htmlFor="hostname" className="sr-only">
            Nom de domaine
          </label>
          <input
            id="hostname"
            name="hostname"
            required
            placeholder="www.mon-restaurant.com"
            className={cx(inputClass, 'flex-1 min-w-52')}
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Ajout…' : 'Ajouter'}
          </Button>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Les domaines personnalisés sont inclus dans les plans supérieurs.
          Votre adresse Magyapro reste disponible et fonctionnelle.
        </p>
      )}
    </Card>
  );
}
