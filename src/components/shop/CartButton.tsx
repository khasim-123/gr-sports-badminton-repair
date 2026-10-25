import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { cx } from '../public/home/ui';

interface CartButtonProps {
  className?: string;
  /** 'light' = bordered white button (headers); 'dark' = on an ink background. */
  tone?: 'light' | 'dark';
  /** Show the word "Cart" next to the icon (wide screens). */
  withLabel?: boolean;
}

/** Cart button with an item-count badge; opens the cart drawer. */
export const CartButton: React.FC<CartButtonProps> = ({ className, tone = 'light', withLabel }) => {
  const { count, openCart } = useCart();
  const label = count === 0 ? 'Cart, empty' : `Cart, ${count} item${count === 1 ? '' : 's'}`;
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={label}
      aria-haspopup="dialog"
      title="Cart"
      className={cx(
        'relative inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-2.5 text-[15px] font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
        tone === 'dark' ? 'text-white border border-white/30 hover:bg-white/10' : 'border border-line bg-white text-ink hover:border-ink/40',
        withLabel && 'sm:px-3.5',
        className,
      )}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {withLabel && <span className="hidden sm:inline">Cart</span>}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[12px] font-bold leading-none text-ink ring-2 ring-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};
