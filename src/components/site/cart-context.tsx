'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

/**
 * Panier côté client.
 *
 * Il ne sert qu'à l'affichage et à la saisie. Les prix qu'il contient sont des
 * *estimations* reprises du menu : au moment de valider, seuls les
 * identifiants et les quantités sont envoyés au serveur, qui recalcule tout.
 * Un panier trafiqué dans le navigateur ne change donc rien au montant payé.
 *
 * Le panier est conservé dans `localStorage`, cloisonné par restaurant : les
 * paniers de deux restaurants différents ne se mélangent jamais.
 */

export type CartOption = {
  id: string;
  groupName: string;
  name: string;
  priceDelta: number;
};

export type CartLine = {
  /** Clé locale : un même produit avec des options différentes = deux lignes. */
  key: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  variantId: string | null;
  variantName: string | null;
  options: CartOption[];
  /** Prix unitaire estimé, options comprises. Affichage uniquement. */
  unitPrice: number;
  quantity: number;
};

type CartState = { lines: CartLine[] };

type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'key'> }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'restore'; lines: CartLine[] };

function lineKey(line: Omit<CartLine, 'key'>): string {
  const optionIds = line.options.map((option) => option.id).sort().join(',');
  return `${line.productId}|${line.variantId ?? ''}|${optionIds}`;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.line);
      const existing = state.lines.find((line) => line.key === key);

      // Ajouter deux fois la même configuration incrémente la quantité plutôt
      // que de créer une seconde ligne identique.
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.key === key
              ? { ...line, quantity: Math.min(99, line.quantity + action.line.quantity) }
              : line,
          ),
        };
      }
      return { lines: [...state.lines, { ...action.line, key }] };
    }

    case 'setQuantity': {
      if (action.quantity <= 0) {
        return { lines: state.lines.filter((line) => line.key !== action.key) };
      }
      return {
        lines: state.lines.map((line) =>
          line.key === action.key
            ? { ...line, quantity: Math.min(99, action.quantity) }
            : line,
        ),
      };
    }

    case 'remove':
      return { lines: state.lines.filter((line) => line.key !== action.key) };

    case 'clear':
      return { lines: [] };

    case 'restore':
      return { lines: action.lines };
  }
}

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  /** Sous-total estimé. Le montant qui fait foi est calculé par le serveur. */
  estimatedSubtotal: number;
  currency: string;
  addLine: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  restaurantId,
  currency,
  children,
}: {
  restaurantId: string;
  currency: string;
  children: React.ReactNode;
}) {
  const storageKey = `magyapro:cart:${restaurantId}`;
  const [state, dispatch] = useReducer(reducer, { lines: [] });

  // Restauration au montage. `localStorage` n'existe pas au rendu serveur,
  // d'où la lecture dans un effet plutôt qu'à l'initialisation.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartLine[];
      if (Array.isArray(parsed)) dispatch({ type: 'restore', lines: parsed });
    } catch {
      // Contenu corrompu ou stockage indisponible (navigation privée) :
      // on repart d'un panier vide plutôt que de casser la page.
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.lines));
    } catch {
      // Quota dépassé ou stockage refusé : le panier reste utilisable en
      // mémoire pour la session en cours.
    }
  }, [state.lines, storageKey]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      itemCount: state.lines.reduce((sum, line) => sum + line.quantity, 0),
      estimatedSubtotal: state.lines.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity,
        0,
      ),
      currency,
      addLine: (line) => dispatch({ type: 'add', line }),
      setQuantity: (key, quantity) => dispatch({ type: 'setQuantity', key, quantity }),
      removeLine: (key) => dispatch({ type: 'remove', key }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state.lines, currency],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l\'intérieur d\'un CartProvider.');
  }
  return context;
}

/** Sérialise le panier pour l'API : identifiants et quantités, aucun prix. */
export function toCheckoutItems(lines: CartLine[]) {
  return lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    optionIds: line.options.map((option) => option.id),
    quantity: line.quantity,
  }));
}
