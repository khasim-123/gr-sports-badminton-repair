import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;
let savedOverflow = '';
let savedPadding = '';

function lockScroll() {
  if (openCount++ > 0) return;
  const html = document.documentElement;
  const scrollbar = window.innerWidth - html.clientWidth;
  savedOverflow = html.style.overflow;
  savedPadding = document.body.style.paddingRight;
  html.style.overflow = 'hidden';
  if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  if (--openCount > 0) return;
  openCount = 0;
  document.documentElement.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPadding;
}

/**
 * Modal behaviour shared by Dialog and the mobile menu: locks page scroll, moves focus in,
 * keeps Tab inside `panelRef`, closes on Esc, and restores focus on close.
 */
export function useModalBehavior(
  open: boolean,
  panelRef: React.RefObject<HTMLElement>,
  onClose: () => void,
  initialFocusRef?: React.RefObject<HTMLElement>,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();
    // Wait a frame so the portal content is laid out.
    const raf = requestAnimationFrame(() => (initialFocusRef?.current || panelRef.current)?.focus({ preventScroll: true }));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Visually hide the title (still announced). */
  hideTitle?: boolean;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus when the dialog opens (defaults to the panel). */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Content above the title, edge to edge (e.g. a photo). */
  media?: React.ReactNode;
}

/**
 * Accessible modal dialog rendered into document.body: focus moves in and is kept inside,
 * Esc / backdrop click close it, the page behind doesn't scroll, and focus returns to the
 * element that opened it. Tall content scrolls inside the overlay on short screens.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  size = 'md',
  initialFocusRef,
  media,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalBehavior(open, panelRef, onClose, initialFocusRef);

  if (!open) return null;

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-ink/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-6"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={`relative w-full ${width} bg-white text-ink shadow-2xl rounded-t-2xl sm:rounded-xl outline-none overflow-clip animate-in fade-in`}
        >
          {/* Close button stays in view while long content scrolls (the overlay is the scroller). */}
          <div className="sticky top-0 z-10 flex h-0 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm ring-1 ring-black/5 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {media}
          <div className="px-5 pt-5 pb-6 sm:px-7 sm:pt-6 sm:pb-7">
            <div className={hideTitle ? 'sr-only' : media ? 'min-w-0' : 'min-w-0 pr-12'}>
              <h2 id={titleId} className="font-display font-semibold text-[28px] leading-[1.08] text-ink text-balance">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1.5 text-[15px] text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
