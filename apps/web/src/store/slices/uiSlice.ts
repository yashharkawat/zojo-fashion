import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** ms before auto-dismiss; 0 = sticky */
  duration: number;
}

export interface UiState {
  cartDrawerOpen: boolean;
  mobileNavOpen: boolean;
  searchOpen: boolean;
  loginModalOpen: boolean;
  toasts: Toast[];
}

const initialState: UiState = {
  cartDrawerOpen: false,
  mobileNavOpen: false,
  searchOpen: false,
  loginModalOpen: false,
  toasts: [],
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openCartDrawer(state) { state.cartDrawerOpen = true; },
    closeCartDrawer(state) { state.cartDrawerOpen = false; },
    toggleCartDrawer(state) { state.cartDrawerOpen = !state.cartDrawerOpen; },

    openMobileNav(state) { state.mobileNavOpen = true; },
    closeMobileNav(state) { state.mobileNavOpen = false; },

    openSearch(state) { state.searchOpen = true; },
    closeSearch(state) { state.searchOpen = false; },

    openLoginModal(state) { state.loginModalOpen = true; },
    closeLoginModal(state) { state.loginModalOpen = false; },

    pushToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      state.toasts.push({ ...action.payload, id: `${Date.now()}-${Math.random()}` });
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) { state.toasts = []; },
  },
});

export const {
  openCartDrawer, closeCartDrawer, toggleCartDrawer,
  openMobileNav, closeMobileNav,
  openSearch, closeSearch,
  openLoginModal, closeLoginModal,
  pushToast, dismissToast, clearToasts,
} = uiSlice.actions;

export default uiSlice.reducer;
