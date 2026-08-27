'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { Button, Field, inputClass } from '@/components/ui';

const BUSINESS_TYPES = [
  { value: 'MERCERIE', label: 'Mercerie & tissus' },
  { value: 'GROCERY', label: 'Alimentation générale' },
  { value: 'CLOTHING', label: 'Vêtements & mode' },
  { value: 'SHOES', label: 'Chaussures' },
  { value: 'COSMETICS', label: 'Cosmétique & beauté' },
  { value: 'ELECTRONICS', label: 'Électronique' },
  { value: 'HARDWARE', label: 'Quincaillerie' },
  { value: 'CONSTRUCTION', label: 'Matériaux de construction' },
  { value: 'HOUSEHOLD', label: 'Produits ménagers' },
  { value: 'PHARMACY', label: 'Parapharmacie' },
  { value: 'GENERAL', label: 'Commerce général' },
  { value: 'OTHER', label: 'Autre / Personnalisé' },
] as const;

const CURRENCIES = [
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'GHS', label: 'Cedi ghanéen (GHS)' },
  { value: 'NGN', label: 'Naira nigérian (NGN)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export function OnboardingForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);

    try {
      await api.post('/api/boutique/onboarding', {
        businessType: String(formData.get('businessType') ?? 'OTHER'),
        phone: String(formData.get('phone') ?? ''),
        addressLine: String(formData.get('addressLine') ?? ''),
        city: String(formData.get('city') ?? ''),
        currency: String(formData.get('currency') ?? 'XOF'),
      });
      router.replace('/boutique/dashboard');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setFormError("Une erreur inattendue s'est produite. Réessayez.");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </div>
      )}

      <Field label="Type de commerce" htmlFor="businessType" required>
        <select id="businessType" name="businessType" required className={inputClass}>
          {BUSINESS_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Téléphone" htmlFor="phone" required error={fieldErrors.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          className={inputClass}
          placeholder="+225 07 00 00 00 00"
        />
      </Field>

      <Field label="Adresse" htmlFor="addressLine" required error={fieldErrors.addressLine}>
        <input
          id="addressLine"
          name="addressLine"
          type="text"
          required
          className={inputClass}
          placeholder="Rue, quartier"
        />
      </Field>

      <Field label="Ville" htmlFor="city" required error={fieldErrors.city}>
        <input id="city" name="city" type="text" required className={inputClass} />
      </Field>

      <Field label="Devise" htmlFor="currency" required>
        <select id="currency" name="currency" required className={inputClass} defaultValue="XOF">
          {CURRENCIES.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit" loading={pending} className="w-full" size="lg">
        Accéder à mon tableau de bord
      </Button>
    </form>
  );
}
