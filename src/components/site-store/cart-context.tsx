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
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  unit: string;
  imageUrl: string | null;
};

type CartState = { lines: CartLine[] };

type CartAction =
  | { type: 'ADD'; line: Omit<CartLine, 'quantity'>; quantity: number }
  | { type: 'SET_QUANTITY'; productId: string; quantity: number }
  | { type: 'REMOVE'; productId: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; lines: CartLine[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { lines: action.lines };
    case 'ADD': {
      const existing = state.lines.find((l) => l.productId === action.line.productId);
      if (existing) {
        const quantity = Math.min(existing.quantity + action.quantity, existing.maxStock);
        return {
          lines: state.lines.map((l) =>
            l.productId === action.line.productId ? { ...l, quantity } : l,
          ),
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
            l.productId === action.productId
              ? { ...l, quantity: Math.min(quantity, l.maxStock) }
              : l,
          )
          .filter((l) => l.quantity > 0),
      };
    }
    case 'REMOVE':
      return { lines: state.lines.filter((l) => l.productId !== action.productId) };
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
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
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
    setQuantity: (productId, quantity) => dispatch({ type: 'SET_QUANTITY', productId, quantity }),
    removeLine: (productId) => dispatch({ type: 'REMOVE', productId }),
    clear: () => dispatch({ type: 'CLEAR' }),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé sous CartProvider.');
  return ctx;
}
