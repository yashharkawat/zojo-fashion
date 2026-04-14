'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeLoginModal } from '@/store/slices/uiSlice';
import { LoginModal } from './LoginModal';

/** Reads `ui.loginModalOpen` and renders the modal. Mounted in root layout. */
export function GlobalLoginModal() {
  const open = useAppSelector((s) => s.ui.loginModalOpen);
  const dispatch = useAppDispatch();
  return <LoginModal open={open} onClose={() => dispatch(closeLoginModal())} />;
}
