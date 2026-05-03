import type { AppDispatch, RootState } from '@/store';
import { hydrateCart } from '@/store/slices/cartSlice';
import { getCart, putCart, serverCartToState } from './api';

/**
 * Sync cart after a session is established.
 *
 * Strategy:
 *  - Always fetch the server cart first (server is source of truth for logged-in users).
 *  - If the server cart has items, use them — this covers page reloads where the server
 *    already holds the correct state. Using mergeCart here would double quantities on
 *    every reload because mergeCart adds local qty on top of existing server qty.
 *  - If the server cart is empty but local storage has items, the user likely just logged
 *    in as a guest who had items — push the exact local quantities to the server.
 */
export async function postLoginCartSync(dispatch: AppDispatch, getState: () => RootState) {
  const { items: localItems } = getState().cart;
  try {
    const serverData = await getCart();
    if (serverData.items.length > 0) {
      dispatch(hydrateCart(serverCartToState(serverData)));
    } else if (localItems.length > 0) {
      // Server is empty; guest user just logged in — push exact local quantities.
      const pushed = await putCart({
        items: localItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      dispatch(hydrateCart(serverCartToState(pushed)));
    }
    // Both empty: nothing to sync.
  } catch {
    /* keep local cart if the API is unreachable */
  }
}
