import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Cart slice (localStorage + Redux). When logged in, syncs to `GET/PUT /api/v1/cart`
 * after login (`postLoginCartSync`) and on edits (`CartServerSync`).
 */

export interface CartLine {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantLabel: string; // "M / Black"
  imageUrl: string | null;
  unitPricePaise: number;
  quantity: number;
  /** Server-verified at checkout — client never trusts its own math */
  addedAt: number;
}

export interface CartState {
  items: CartLine[];
  couponCode: string | null;
  lastModified: number;
}

const initialState: CartState = {
  items: [],
  couponCode: null,
  lastModified: 0,
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<Omit<CartLine, 'addedAt'> & { quantity?: number }>) {
      const { quantity = 1, ...line } = action.payload;
      const existing = state.items.find((i) => i.variantId === line.variantId);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, 10);
      } else {
        state.items.push({ ...line, quantity, addedAt: Date.now() });
      }
      state.lastModified = Date.now();
    },
    updateQuantity(state, action: PayloadAction<{ variantId: string; quantity: number }>) {
      const line = state.items.find((i) => i.variantId === action.payload.variantId);
      if (!line) return;
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((i) => i.variantId !== action.payload.variantId);
      } else {
        line.quantity = Math.min(action.payload.quantity, 10);
      }
      state.lastModified = Date.now();
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.variantId !== action.payload);
      state.lastModified = Date.now();
    },
    applyCoupon(state, action: PayloadAction<string>) {
      state.couponCode = action.payload.toUpperCase();
    },
    clearCoupon(state) {
      state.couponCode = null;
    },
    clearCart(state) {
      state.items = [];
      state.couponCode = null;
      state.lastModified = Date.now();
    },
    hydrateCart(_, action: PayloadAction<CartState>) {
      return action.payload;
    },
  },
});

export const {
  addItem,
  updateQuantity,
  removeItem,
  applyCoupon,
  clearCoupon,
  clearCart,
  hydrateCart,
} = cartSlice.actions;

export default cartSlice.reducer;

// ── Selectors (memoized in consumers via reselect if needed) ──

export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartCount = (state: { cart: CartState }): number =>
  state.cart.items.reduce((sum, i) => sum + i.quantity, 0);
export const selectCartSubtotalPaise = (state: { cart: CartState }): number =>
  state.cart.items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
export const selectCouponCode = (state: { cart: CartState }) => state.cart.couponCode;
