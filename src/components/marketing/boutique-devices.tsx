import { DeviceScene, SceneBadge, SceneToast, type SceneDevice } from '@/components/marketing/device-scene';

/**
 * Le héros de la page Boutique : MagyaPro Boutique, le vrai, sur les trois
 * appareils d'un commerce — l'ordinateur du bureau (la vue d'ensemble), la
 * tablette du comptoir (la caisse, un sac de sucre au panier), le téléphone du
 * gérant (les ruptures à venir).
 *
 * Trois images séparées (`public/marketing/boutique/hero-*.webp`, produites
 * par `scripts/capture-hero-boutique.mjs`). Par-dessus, ce que la caisse fait
 * dans la journée : la vente au sac s'encaisse, puis le stock bas s'annonce.
 * Il remplace le ticket dessiné : l'argument du sac et du carton y est
 * toujours, mais dans l'écran où on le vit.
 */
const DEVICES: readonly SceneDevice[] = [
  { src: '/marketing/boutique/hero-ordinateur.webp', left: 5, top: 3.57, width: 85, size: [1632, 972], rise: 0, float: '-1500ms', priority: true },
  { src: '/marketing/boutique/hero-tablette.webp', left: 50.63, top: 41.96, width: 47.5, size: [912, 650], rise: 220, float: '-4200ms' },
  { src: '/marketing/boutique/hero-telephone.webp', left: 2.5, top: 41.96, width: 18.75, size: [360, 746], rise: 380, float: '-2600ms' },
];

export function BoutiqueDevices() {
  return (
    <DeviceScene
      label="MagyaPro Boutique sur un ordinateur, une tablette et un téléphone : les ventes du jour, la caisse avec un sac de sucre au panier, et les ruptures à venir."
      devices={DEVICES}
    >
      {/* La vente au sac s'encaisse : la notification tombe sur l'ordinateur. */}
      <SceneToast
        icon="✓"
        iconClassName="bg-[#2f7d4f] text-white"
        title="Vente encaissée · 46 500 F CFA"
        detail="1 sac de sucre de 50 kg · 1 boîte de tomate"
        delay="1.6s"
      />
      {/* Et le stock qui baisse s'annonce sur le téléphone. */}
      <SceneBadge className="bg-[#e0bd52] text-[#1c1712]" delay="5.1s">
        <span aria-hidden="true">!</span> 3 stocks faibles · à commander
      </SceneBadge>
    </DeviceScene>
  );
}
