'use client';

import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';

/**
 * Panier du site public d'une boutique — même principe que `CartProvider`
 * (Restaurant, `src/components/site/cart-context.tsx`) : état client
 * persisté en `localStorage`, cloisonné par boutique, jamais la source de
 * vérité des prix (recalculés côté serveur à la commande). Fichier séparé,
 * jamais partagé avec l'équivalent Restaurant.
 */

export type CartLine = {
  productId: string;
  /**
   * Déclinaison choisie (taille, couleur…). Absente sur les paniers créés
   * avant les déclinaisons, et sur les produits qui n'en ont pas : le serveur
   * retombe alors sur la première déclinaison active du produit.
   */
  variantId?: string;
  /** « M · Noir », figé à l'ajout pour l'affichage du panier. */
  variantLabel?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  unit: string;
  imageUrl: string | null;
};

/**
 * Deux tailles du même t-shirt sont deux lignes distinctes du panier : la clé
 * est donc le couple produit + déclinaison, jamais le produit seul.
 */
export function cartLineKey(line: Pick<CartLine, 'productId' | 'variantId'>): string {
  return `${line.productId}:${line.variantId ?? 'default'}`;
}

type CartState = { lines: CartLine[] };

type CartAction =
  | { type: 'ADD'; line: Omit<CartLine, 'quantity'>; quantity: number }
  | { type: 'SET_QUANTITY'; key: string; quantity: number }
  | { type: 'REMOVE'; key: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; lines: CartLine[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { lines: action.lines };
    case 'ADD': {
      const key = cartLineKey(action.line);
      const existing = state.lines.find((l) => cartLineKey(l) === key);
      if (existing) {
        const quantity = Math.min(existing.quantity + action.quantity, existing.maxStock);
        return {
          lines: state.lines.map((l) => (cartLineKey(l) === key ? { ...l, quantity } : l)),
        };
      }
      const quantity = Math.min(action.quantity, action.line.maxStock);
      if (quantity <= 0) return state;
      return { lines: [...state.lines, { ...action.line, quantity }] };
    }
    case 'SET_QUANTITY': {
      const quantity = Math.max(0, Math.min(action.quantity, 1_000_000));
      return {
        lines: state.lines
          .map((l) =>
            cartLineKey(l) === action.key ? { ...l, quantity: Math.min(quantity, l.maxStock) } : l,
          )
          .filter((l) => l.quantity > 0),
      };
    }
    case 'REMOVE':
      return { lines: state.lines.filter((l) => cartLineKey(l) !== action.key) };
    case 'CLEAR':
      return { lines: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  lines: CartLine[];
  total: number;
  addLine: (line: Omit<CartLine, 'quantity'>, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(storeId: string) {
  return `magyapro:store-cart:${storeId}`;
}

export function CartProvider({ storeId, children }: { storeId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [] });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(storeId));
      if (raw) dispatch({ type: 'HYDRATE', lines: JSON.parse(raw) as CartLine[] });
    } catch {
      // Panier illisible (données corrompues) : on repart d'un panier vide.
    }
  }, [storeId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(storeId), JSON.stringify(state.lines));
    } catch {
      // Stockage indisponible (navigation privée, quota) : le panier reste en mémoire pour la session.
    }
  }, [storeId, state.lines]);

  const total = state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const value: CartContextValue = {
    lines: state.lines,
    total,
    addLine: (line, quantity) => dispatch({ type: 'ADD', line, quantity }),
    setQuantity: (key, quantity) => dispatch({ type: 'SET_QUANTITY', key, quantity }),
    removeLine: (key) => dispatch({ type: 'REMOVE', key }),
    clear: () => dispatch({ type: 'CLEAR' }),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé sous CartProvider.');
  return ctx;
}
