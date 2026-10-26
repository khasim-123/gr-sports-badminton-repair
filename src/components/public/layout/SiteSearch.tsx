import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CalendarDays, FileText, GraduationCap, Grid3x3, Search, Shirt, Trophy, X } from 'lucide-react';
import type { PageIntent, PublicPageId } from '../../../utils/publicPages';
import { useModalBehavior } from '../home/Dialog';
import { useShop } from '../home/shop';
import { WhatsAppIcon, cx } from '../home/ui';
import { QUICK_LINK_KEYS, searchHref, searchIndex, useSearchIndex, type SearchGroup, type SearchItem, type SearchResultGroup } from './searchIndex';

const GROUP_ICON: Record<SearchGroup, React.ElementType> = {
  Rackets: Trophy,
  Strings: Grid3x3,
  'T-shirts': Shirt,
  'Stringing & repairs': Grid3x3,
  Academies: GraduationCap,
  Events: CalendarDays,
  Pages: FileText,
};

const PLACEHOLDER = 'Search rackets, strings, T-shirts, academies…';

type OpenPage = (page: PublicPageId, intent?: PageIntent) => void;

/** Query, results and keyboard selection shared by the search bar and the search dialog. */
function useSearch(active: boolean) {
  const [query, setQuery] = useState('');
  const index = useSearchIndex(active);
  const groups = useMemo<SearchResultGroup[]>(() => {
    if (query.trim()) return searchIndex(index, query);
    const quick = QUICK_LINK_KEYS.map((k) => index.find((it) => it.key === k)).filter((it): it is SearchItem => !!it);
    return [{ group: 'Pages', items: quick }];
  }, [index, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => setActiveIndex(-1), [query]);
  return { query, setQuery, groups, flat, activeIndex, setActiveIndex };
}

/** The results list (listbox) with group headings. */
const SearchResults: React.FC<{
  id: string;
  query: string;
  groups: SearchResultGroup[];
  flat: SearchItem[];
  activeIndex: number;
  onHover: (i: number) => void;
  onPick: (it: SearchItem) => void;
}> = ({ id, query, groups, flat, activeIndex, onHover, onPick }) => {
  const SHOP = useShop();
  if (query.trim() && flat.length === 0) {
    return (
      <div className="px-4 py-6 text-center" role="status">
        <p className="text-[15px] font-medium text-ink">No matches for “{query.trim()}”</p>
        <p className="mt-1 text-[14px] text-ink-muted">Try a brand or a model, e.g. “Yonex” or “BG 80”, or ask us.</p>
        <a
          href={SHOP.whatsAppLink(SHOP.greeting(`I'm looking for ${query.trim()}.`))}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-semibold text-ink hover:border-ink/40"
        >
          <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
          Ask on WhatsApp
        </a>
      </div>
    );
  }
  return (
    <ul id={id} role="listbox" aria-label="Search results" className="py-2">
      {groups.map((g) => (
        <li key={g.group} role="presentation">
          <p id={`${id}-${g.group}`} className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted first:pt-1">
            {query.trim() ? g.group : 'Quick links'}
          </p>
          <ul role="group" aria-labelledby={`${id}-${g.group}`}>
            {g.items.map((it) => {
              const i = flat.indexOf(it);
              const Icon = GROUP_ICON[it.group];
              return (
                <li
                  key={it.key}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseMove={() => i !== activeIndex && onHover(i)}
                  // Keep focus in the input until the pick (a blur would close the list first).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      window.open(searchHref(it), '_blank', 'noopener');
                      return;
                    }
                    onPick(it);
                  }}
                  className={cx('mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2', i === activeIndex ? 'bg-paper' : 'hover:bg-paper')}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
                    {it.image ? (
                      <img src={it.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <Icon className="h-[18px] w-[18px] text-ink-soft" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{it.title}</span>
                    {it.detail && <span className="block truncate text-[13px] text-ink-muted">{it.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
};

/** Arrow keys / Enter / Escape on the search input. */
function keyHandler(
  s: ReturnType<typeof useSearch>,
  pick: (it: SearchItem) => void,
  onEscape: () => void,
): (e: React.KeyboardEvent<HTMLInputElement>) => void {
  return (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!s.flat.length) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      s.setActiveIndex((i) => (i + step + s.flat.length + (i < 0 && step < 0 ? 1 : 0)) % s.flat.length);
    } else if (e.key === 'Enter') {
      const it = s.flat[s.activeIndex >= 0 ? s.activeIndex : 0];
      if (it && (s.query.trim() || s.activeIndex >= 0)) {
        e.preventDefault();
        pick(it);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    }
  };
}

const inputClass =
  'block h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-muted transition-colors hover:border-ink/30 focus:border-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/10 [&::-webkit-search-cancel-button]:hidden';

/** Search field in the header (laptops): results drop down under it. */
export const SearchBar: React.FC<{ onOpenPage: OpenPage; onActiveChange?: (active: boolean) => void }> = ({ onOpenPage, onActiveChange }) => {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const s = useSearch(used);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onActiveChange?.(open), [open, onActiveChange]);
  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (it: SearchItem) => {
    setOpen(false);
    s.setQuery('');
    inputRef.current?.blur();
    onOpenPage(it.page, it.intent);
  };

  return (
    <div ref={wrapRef} className="relative w-full" role="search">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search the site"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && s.activeIndex >= 0 ? `${uid}-list-opt-${s.activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={PLACEHOLDER}
        value={s.query}
        onChange={(e) => {
          s.setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setUsed(true);
          setOpen(true);
        }}
        onKeyDown={keyHandler(s, pick, () => {
          if (s.query) {
            s.setQuery('');
            return;
          }
          setOpen(false);
          inputRef.current?.blur();
        })}
        className={inputClass}
      />
      {s.query && (
        <button
          type="button"
          onClick={() => {
            s.setQuery('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white shadow-xl shadow-ink/10">
          <SearchResults
            id={`${uid}-list`}
            query={s.query}
            groups={s.groups}
            flat={s.flat}
            activeIndex={s.activeIndex}
            onHover={s.setActiveIndex}
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
};

/** Magnifier button (phones, and laptops once the menu moves into the header): opens a search dialog. */
export const SearchButton: React.FC<{ onOpenPage: OpenPage; className?: string }> = ({ onOpenPage, className }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search"
        aria-haspopup="dialog"
        className={cx(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors hover:border-ink/40',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
          className,
        )}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <SearchDialog
          onClose={() => setOpen(false)}
          onPick={(it) => {
            setOpen(false);
            window.setTimeout(() => onOpenPage(it.page, it.intent), 0);
          }}
        />
      )}
    </>
  );
};

const SearchDialog: React.FC<{ onClose: () => void; onPick: (it: SearchItem) => void }> = ({ onClose, onPick }) => {
  const uid = useId();
  const s = useSearch(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useModalBehavior(true, panelRef, onClose, inputRef);

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink/50 sm:p-6 sm:pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabIndex={-1}
        className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white outline-none sm:h-auto sm:max-h-[80vh] sm:rounded-2xl sm:shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line p-3" role="search">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-paper sm:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label="Search the site"
              aria-expanded
              aria-controls={`${uid}-list`}
              aria-autocomplete="list"
              aria-activedescendant={s.activeIndex >= 0 ? `${uid}-list-opt-${s.activeIndex}` : undefined}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder={PLACEHOLDER}
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
              onKeyDown={keyHandler(s, onPick, () => (s.query ? s.setQuery('') : onClose()))}
              className={inputClass}
            />
            {s.query && (
              <button
                type="button"
                onClick={() => {
                  s.setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-paper sm:inline-flex"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SearchResults
            id={`${uid}-list`}
            query={s.query}
            groups={s.groups}
            flat={s.flat}
            activeIndex={s.activeIndex}
            onHover={s.setActiveIndex}
            onPick={onPick}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
