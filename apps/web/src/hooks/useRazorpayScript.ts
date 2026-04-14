'use client';

import { useEffect, useState } from 'react';

type State = 'idle' | 'loading' | 'ready' | 'error';

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads the Razorpay Checkout script once per page. Safe across remounts.
 */
export function useRazorpayScript(): State {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) {
      setState('ready');
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      setState('loading');
      const onLoad = () => setState('ready');
      const onError = () => setState('error');
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
      };
    }

    setState('loading');
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => setState('ready');
    s.onerror = () => setState('error');
    document.body.appendChild(s);
  }, []);

  return state;
}
