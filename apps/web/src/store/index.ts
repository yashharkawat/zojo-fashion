import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer, { hydrateCart, type CartState } from './slices/cartSlice';
import uiReducer from './slices/uiSlice';

const AUTH_STORAGE_KEY = 'zojo.auth.accessToken';
const CART_STORAGE_KEY = 'zojo.cart.v1';

export function makeStore() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      cart: cartReducer,
      ui: uiReducer,
    },
    middleware: (getDefault) => getDefault({ serializableCheck: true }),
  });

  // ── Hydrate from localStorage on client ──
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        store.dispatch(hydrateCart(parsed));
      }
    } catch {
      /* ignore corrupted storage */
    }

    // Persist cart on every change
    store.subscribe(() => {
      try {
        const state = store.getState();
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
        if (state.auth.accessToken) {
          localStorage.setItem(AUTH_STORAGE_KEY, state.auth.accessToken);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch {
        /* storage quota / private mode */
      }
    });
  }

  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
