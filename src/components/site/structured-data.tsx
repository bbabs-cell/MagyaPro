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

  // `JSON.stringify` n'échappe ni « < » ni « > » : un nom ou une description
  // de restaurant contenant `</script>` refermerait cette balise et
  // permettrait d'injecter du script arbitraire, exécuté pour chaque
  // visiteur du site. `<` neutralise ce risque sans changer la valeur
  // JSON-LD lue par les moteurs de recherche.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: json }}
      />
      <span className="sr-only">{openState.label}</span>
    </>
  );
}
