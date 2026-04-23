import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPPORT' | 'SUPER_ADMIN';
  gstin: string | null;
}

export interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  status: 'idle',
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ accessToken: string; user: PublicUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.status = 'authenticated';
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      state.status = 'authenticated';
    },
    /** Puts JWT back from `localStorage` on startup — `status` stays `idle` until `/auth/me` succeeds. */
    restoreAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    setUser(state, action: PayloadAction<PublicUser>) {
      state.user = action.payload;
    },
    setAuthStatus(state, action: PayloadAction<AuthState['status']>) {
      state.status = action.payload;
    },
    logout(state) {
      state.accessToken = null;
      state.user = null;
      state.status = 'unauthenticated';
    },
  },
});

export const { setAuth, setAccessToken, restoreAccessToken, setUser, setAuthStatus, logout } = authSlice.actions;
export default authSlice.reducer;
