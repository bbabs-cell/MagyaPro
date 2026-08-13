import type { OpenState } from '@/lib/site/hours';

/**
 * Données structurées schema.org.
 *
 * Elles permettent aux moteurs d'afficher horaires, adresse et téléphone
 * directement dans les résultats. Seules les informations réellement
 * renseignées sont émises : un balisage inventé dégrade le référencement au
 * lieu de l'améliorer.
 */
export function StructuredData({
  restaurant,
  openState,
}: {
  restaurant: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    phone: string | null;
    email: string | null;
    addressLine: string | null;
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    currency: string;
    openingHours: Array<{
      dayOfWeek: number;
      isClosed: boolean;
      opensAt: string;
      closesAt: string;
    }>;
  };
  openState: OpenState;
}) {
  const SCHEMA_DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    currenciesAccepted: restaurant.currency,
  };

  if (restaurant.description) data.description = restaurant.description;
  if (restaurant.logoUrl) data.logo = restaurant.logoUrl;
  if (restaurant.coverUrl) data.image = restaurant.coverUrl;
  if (restaurant.phone) data.telephone = restaurant.phone;
  if (restaurant.email) data.email = restaurant.email;

  if (restaurant.addressLine || restaurant.city) {
    data.address = {
      '@type': 'PostalAddress',
      ...(restaurant.addressLine ? { streetAddress: restaurant.addressLine } : {}),
      ...(restaurant.city ? { addressLocality: restaurant.city } : {}),
      ...(restaurant.country ? { addressCountry: restaurant.country } : {}),
    };
  }

  if (restaurant.latitude !== null && restaurant.longitude !== null) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    };
  }

  const openHours = restaurant.openingHours.filter((hour) => !hour.isClosed);
  if (openHours.length > 0) {
    data.openingHoursSpecification = openHours.map((hour) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[hour.dayOfWeek]}`,
      opens: hour.opensAt,
      closes: hour.closesAt,
    }));
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Le contenu est un objet construit ici puis sérialisé par JSON.stringify,
        // qui échappe les caractères problématiques. Aucune chaîne brute
        // provenant du restaurateur n'est concaténée dans le script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
      <span className="sr-only">{openState.label}</span>
    </>
  );
}
