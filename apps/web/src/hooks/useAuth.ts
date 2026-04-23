'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout, setAuth, type PublicUser } from '@/store/slices/authSlice';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { accessToken, user, status } = useAppSelector((s) => s.auth);

  return {
    accessToken,
    user,
    status,
    /** Session established after login or bootstrap (either `user` or `accessToken` is enough for UI). */
    isAuthenticated: status === 'authenticated' && (!!user || !!accessToken),
    isAdmin: !!user && ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(user.role),
    login: (accessToken: string, user: PublicUser) => dispatch(setAuth({ accessToken, user })),
    logout: () => dispatch(logout()),
  };
}
