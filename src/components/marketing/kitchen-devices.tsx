import { DeviceScene, SceneBadge, SceneToast, type SceneDevice } from '@/components/marketing/device-scene';

/**
 * Le héros de la page Restaurant : l'écran de cuisine de MagyaPro, le vrai,
 * sur les trois appareils d'un restaurant — l'ordinateur de la caisse, la
 * tablette du passe, le téléphone du patron.
 *
 * Trois images séparées (`public/marketing/cuisine-*.webp`, produites par
 * `scripts/capture-hero-cuisine.mjs`), pour que chaque appareil vive à part.
 * Par-dessus, ce qui se passe vraiment en service : une nouvelle commande
 * tombe sur l'ordinateur, une commande prête s'annonce sur le téléphone — en
 * boucle, sans jamais masquer l'écran.
 */
const DEVICES: readonly SceneDevice[] = [
  { src: '/marketing/cuisine-ordinateur.webp', left: 5, top: 3.57, width: 85, size: [1632, 972], rise: 0, float: '-1500ms', priority: true },
  { src: '/marketing/cuisine-tablette.webp', left: 50.63, top: 41.96, width: 47.5, size: [912, 650], rise: 220, float: '-4200ms' },
  { src: '/marketing/cuisine-telephone.webp', left: 2.5, top: 41.96, width: 18.75, size: [360, 746], rise: 380, float: '-2600ms' },
];

export function KitchenDevices() {
  return (
    <DeviceScene
      label="L'écran de cuisine de MagyaPro sur un ordinateur, une tablette et un téléphone : les commandes à préparer, en préparation et prêtes, avec leur temps d'attente."
      devices={DEVICES}
    >
      {/* Une commande arrive : la notification tombe sur l'ordinateur. */}
      <SceneToast
        icon="M"
        iconClassName="bg-[#c93f1a] text-white"
        title="Nouvelle commande n°27"
        detail="Livraison · 2 × Poulet yassa"
        delay="1.6s"
      />
      {/* Et une autre part : la pastille « prête » sur le téléphone. */}
      <SceneBadge className="bg-[#2f7d4f] text-white" delay="5.1s">
        <span aria-hidden="true">✓</span> n°6 prête · à remettre
      </SceneBadge>
    </DeviceScene>
  );
}
