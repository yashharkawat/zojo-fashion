import { configureStore } from '@reduxjs/toolkit';
import authReducer, { restoreAccessToken } from './slices/authSlice';
import cartReducer, { hydrateCart, type CartState } from './slices/cartSlice';
import uiReducer from './slices/uiSlice';
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from '@/lib/authStorage';

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

  if (typeof window !== 'undefined') {
    try {
      const token = getStoredAccessToken();
      if (token) {
        store.dispatch(restoreAccessToken(token));
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        store.dispatch(hydrateCart(JSON.parse(raw) as CartState));
      }
    } catch {
      /* ignore corrupted storage */
    }

    store.subscribe(() => {
      try {
        const state = store.getState();
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
        if (state.auth.accessToken) {
          setStoredAccessToken(state.auth.accessToken);
        } else {
          clearStoredAccessToken();
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
