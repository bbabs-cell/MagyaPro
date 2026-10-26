import {
  Avocado,
  BeerBottle,
  BowlFood,
  BowlSteam,
  Bread,
  Cake,
  Carrot,
  Coffee,
  Cookie,
  CookingPot,
  Egg,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Leaf,
  Martini,
  OrangeSlice,
  Pepper,
  Pizza,
  Shrimp,
  Wine,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';

/**
 * Icône d'un plat sans photo, déduite de son nom (et de sa catégorie).
 *
 * Une grosse initiale (« S », « V ») disait seulement qu'il manquait une
 * image. Une icône de bol fumant, de poisson ou de cocktail dit déjà ce qu'on
 * va manger, et la carte garde un rythme visuel même avant la première photo.
 *
 * Mots-clés en français et en anglais, testés dans l'ordre : le premier qui
 * correspond l'emporte. Sans correspondance, on retombe sur le couvert.
 */
const RULES: Array<[RegExp, Icon]> = [
  [/burger/i, Hamburger],
  [/pizza/i, Pizza],
  [/poisson|capitaine|thiof|tilapia|fish|saumon|salmon|thon|tuna/i, Fish],
  [/crevette|gambas|shrimp|prawn|fruits? de mer|seafood/i, Shrimp],
  [/œuf|oeuf|omelette|egg/i, Egg],
  [/salade|salad|crudit/i, Leaf],
  [/avocat|avocado|guacamole/i, Avocado],
  [/légume|legume|carotte|vegetable|végé|vege/i, Carrot],
  [/soupe|velouté|veloute|bouillon|soup|potage/i, BowlSteam],
  [/attiéké|attieke|riz|rice|thiéb|thieb|yassa|mafé|mafe|foutou|garba|alloco|couscous/i, BowlFood],
  [/ragoût|ragout|sauce|tajine|mijot|stew|curry/i, CookingPot],
  [/piment|pepper|épicé|epice|spicy/i, Pepper],
  [/pain|bread|sandwich|panini|croissant|baguette/i, Bread],
  [/glace|ice cream|sorbet|gelato/i, IceCream],
  [/gâteau|gateau|cake|tarte|tart|fondant|brownie|dessert/i, Cake],
  [/cookie|biscuit|beignet|donut|crêpe|crepe/i, Cookie],
  [/fruit|jus|juice|bissap|gingembre|ginger|orange|ananas|pineapple|smoothie/i, OrangeSlice],
  [/café|cafe|coffee|thé|the |tea|espresso|cappuccino/i, Coffee],
  [/bière|biere|beer/i, BeerBottle],
  [/vin|wine|champagne/i, Wine],
  [/cocktail|mojito|martini|boisson|drink|soda|eau|water/i, Martini],
];

export function dishIcon(name: string, category?: string | null): Icon {
  for (const [pattern, IconComponent] of RULES) {
    if (pattern.test(name)) return IconComponent;
  }
  if (category) {
    for (const [pattern, IconComponent] of RULES) {
      if (pattern.test(category)) return IconComponent;
    }
  }
  return ForkKnife;
}
