import type { AppDispatch, RootState } from '@/store';
import { hydrateCart } from '@/store/slices/cartSlice';
import { getCart, mergeCart, serverCartToState } from './api';

/** Merge local lines into the server cart (or load server) after a new session is established. */
export async function postLoginCartSync(dispatch: AppDispatch, getState: () => RootState) {
  const { items } = getState().cart;
  try {
    if (items.length > 0) {
      const data = await mergeCart({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      dispatch(hydrateCart(serverCartToState(data)));
    } else {
      const data = await getCart();
      dispatch(hydrateCart(serverCartToState(data)));
    }
  } catch {
    /* keep local cart if the API is unreachable */
  }
}
