/**
 * Site search (header search bar): one index of what the public site lists — rackets, strings,
 * T-shirts, academies, events, stringing and repair services, and the pages themselves — and a
 * forgiving matcher ("yonex", "bg 80", "umpire", "custom jersey"…). Picking a result opens its page
 * with an intent, so the page scrolls to (or opens) that item.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { ApiError } from '../../../services/apiClient';
import { shopService } from '../../../services/shopService';
import type { ApparelProduct } from '../../../types/shop';
import { PUBLIC_PAGES, type PageIntent, type PublicPageId } from '../../../utils/publicPages';
import { CATEGORY_LABELS, activeApparel, productPhotos } from '../../shop/shopFormat';
import { eventDateText, eventPhoto, visibleEvents } from '../home/events';
import { activeStrings, formatInr, hasPrice, inStockCount, safeImageUrl } from '../home/format';
import { activeRackets } from '../home/RacketsSection';
import { useHomeContent } from '../home/useHomeContent';

export type SearchGroup = 'Rackets' | 'Strings' | 'T-shirts' | 'Stringing & repairs' | 'Academies' | 'Events' | 'Pages';

export interface SearchItem {
  key: string;
  group: SearchGroup;
  title: string;
  detail?: string;
  image?: string | null;
  /** Lower-cased, punctuation-free words matched against (title first). */
  titleText: string;
  otherText: string;
  page: PublicPageId;
  intent?: PageIntent;
}

const GROUP_ORDER: SearchGroup[] = ['Rackets', 'Strings', 'T-shirts', 'Stringing & repairs', 'Academies', 'Events', 'Pages'];

/** Lower case, accents and punctuation removed, single spaces ("Li-Ning BG-80" -> "li ning bg 80"). */
export function normalise(text: string | null | undefined): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, ' ')
    .trim();
}

const item = (
  key: string,
  group: SearchGroup,
  title: string,
  page: PublicPageId,
  opts: { detail?: string; image?: string | null; keywords?: string; intent?: PageIntent } = {},
): SearchItem => ({
  key,
  group,
  title,
  detail: opts.detail,
  image: opts.image,
  titleText: normalise(title),
  otherText: normalise(`${opts.detail || ''} ${opts.keywords || ''}`),
  page,
  intent: opts.intent,
});

/** The site's pages and what people may type to find them. */
export const PAGE_ITEMS: SearchItem[] = [
  item('page-badminton', 'Pages', 'Badminton store', 'badminton', { detail: 'Rackets, strings, stringing and repairs', keywords: 'shop store gear equipment' }),
  item('page-book-stringing', 'Pages', 'Book racket stringing', 'services', {
    detail: 'Free pickup and delivery',
    keywords: 'restring stringing string pickup booking book service tension',
    intent: { service: 'stringing' },
  }),
  item('page-book-repair', 'Pages', 'Book a racket repair', 'services', {
    detail: 'We inspect it and send you an estimate',
    keywords: 'repair fix broken crack cracked frame grip handle pickup booking book service',
    intent: { service: 'repair' },
  }),
  item('page-rackets', 'Pages', 'Rackets', 'rackets', { keywords: 'racket racquet bat new' }),
  item('page-used', 'Pages', 'Second-hand rackets', 'rackets', { keywords: 'used resell re sell second hand old pre owned', intent: { condition: 'used' } }),
  item('page-strings', 'Pages', 'Strings', 'strings', { keywords: 'string gut colours' }),
  item('page-tshirts', 'Pages', 'T-shirts & team wear', 'tshirts', { keywords: 'tshirt t shirt tee jersey clothing apparel sportswear' }),
  item('page-custom', 'Pages', 'Custom T-shirts & jerseys', 'tshirts', {
    detail: 'Printed with your team name, names and numbers',
    keywords: 'custom print printed printing team jersey jerseys logo',
    intent: { section: 'custom' },
  }),
  item('page-academies', 'Pages', 'Academies', 'academies', { detail: 'Book a slot at a coaching academy', keywords: 'coaching coach training classes class batch kids junior' }),
  item('page-tournaments', 'Pages', 'Tournament organizing', 'tournaments', { keywords: 'tournament organise organize organiser conduct host' }),
  item('page-umpire', 'Pages', 'Umpires for your tournament', 'tournaments', { keywords: 'umpire umpires referee officials', intent: { item: 'umpire' } }),
  item('page-dress', 'Pages', 'Tournament dress', 'tournaments', { keywords: 'dress uniform tournament t shirts kit', intent: { item: 'dress' } }),
  item('page-trophies', 'Pages', 'Trophies and medals', 'tournaments', { keywords: 'trophy trophies medal medals prizes awards', intent: { item: 'trophies' } }),
  item('page-refreshments', 'Pages', 'Refreshments for your tournament', 'tournaments', { keywords: 'refreshments food drinks snacks water catering', intent: { item: 'refreshments' } }),
  item('page-events', 'Pages', 'Events', 'events', { detail: 'Tournaments and camps', keywords: 'event tournament camp register registration competition' }),
  item('page-courts', 'Pages', 'Book a court', 'courts', { keywords: 'court courts booking book play hall hourly slot' }),
  item('page-faq', 'Pages', 'Common questions', 'badminton', { keywords: 'faq faqs questions help how', intent: { section: 'faq' } }),
  item('page-contact', 'Pages', 'Find the shop', 'home', {
    detail: 'Address, hours and directions',
    keywords: 'contact address location map directions phone hours timings open where',
    intent: { section: 'contact' },
  }),
];

/** Quick links shown before anything is typed. */
export const QUICK_LINK_KEYS = ['page-book-stringing', 'page-book-repair', 'page-rackets', 'page-strings', 'page-custom', 'page-academies', 'page-events', 'page-courts'];

// The T-shirt list isn't part of the site bundle; fetched once, the first time search opens.
let apparelPromise: Promise<ApparelProduct[]> | null = null;
function loadApparel(): Promise<ApparelProduct[]> {
  if (!apparelPromise) {
    apparelPromise = shopService
      .getApparel()
      .then((list) => activeApparel(list))
      .catch((err) => {
        apparelPromise = null; // try again next time
        if (err instanceof ApiError && err.status === 404) return [];
        return [];
      });
  }
  return apparelPromise;
}

/** Everything searchable. `active` starts loading the T-shirts (call it once search is used). */
export function useSearchIndex(active: boolean): SearchItem[] {
  const { content } = useHomeContent();
  const { gettingServices, repairCategories } = useApp();
  const [apparel, setApparel] = useState<ApparelProduct[]>([]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    loadApparel().then((list) => alive && setApparel(list));
    return () => {
      alive = false;
    };
  }, [active]);

  return useMemo(() => {
    const out: SearchItem[] = [];
    for (const r of activeRackets(content?.rackets)) {
      const used = r.condition === 'used';
      out.push(
        item(`racket-${r.id}`, 'Rackets', `${r.brand} ${r.name}`.trim(), 'rackets', {
          detail: [used ? 'Second-hand' : null, hasPrice(r.price) ? formatInr(r.price) : 'Ask for price', r.inStock === false ? 'Out of stock' : null]
            .filter(Boolean)
            .join(' · '),
          image: safeImageUrl(r.images?.[0]),
          keywords: [r.tag, r.balance, r.flex, r.weight, used ? 'used second hand resell' : 'racket'].filter(Boolean).join(' '),
          intent: used ? { condition: 'used', item: r.id } : { brand: r.brand, item: r.id },
        }),
      );
    }
    for (const s of activeStrings(content?.strings || [])) {
      const colours = inStockCount(s);
      out.push(
        item(`string-${s.id}`, 'Strings', `${s.brand} ${s.name}`.trim(), 'strings', {
          detail: [s.gauge, `${colours} colour${colours === 1 ? '' : 's'} in stock`, hasPrice(s.price) ? formatInr(s.price) : null].filter(Boolean).join(' · '),
          image: safeImageUrl(s.variants.find((v) => v.imageUrl)?.imageUrl),
          keywords: [s.code, 'string', s.variants.map((v) => v.colour).join(' ')].filter(Boolean).join(' '),
          intent: { brand: s.brand, item: s.id },
        }),
      );
    }
    for (const p of apparel) {
      out.push(
        item(`apparel-${p.id}`, 'T-shirts', p.name, 'tshirts', {
          detail: [CATEGORY_LABELS[p.category], formatInr(p.price)].filter(Boolean).join(' · '),
          image: productPhotos(p)[0] || null,
          keywords: [p.fabric, p.fit, p.customisable ? 'custom printed' : null, 'tshirt t shirt clothing'].filter(Boolean).join(' '),
          intent: { item: p.id },
        }),
      );
    }
    for (const t of gettingServices.filter((x) => x.isActive !== false)) {
      out.push(
        item(`service-${t.id}`, 'Stringing & repairs', t.name, 'services', {
          detail: [formatInr(t.price), t.turnaround].filter(Boolean).join(' · '),
          keywords: `stringing restring ${t.description || ''}`,
          intent: { service: 'stringing' },
        }),
      );
    }
    for (const c of repairCategories.filter((x) => x.isActive !== false)) {
      out.push(
        item(`repair-${c.id}`, 'Stringing & repairs', c.name, 'services', {
          detail: [`from ${formatInr(c.basePrice)}`, c.turnaround].filter(Boolean).join(' · '),
          keywords: `repair fix broken ${c.description || ''}`,
          intent: { service: 'repair' },
        }),
      );
    }
    for (const a of content?.academies || []) {
      out.push(
        item(`academy-${a.id}`, 'Academies', a.name, 'academies', {
          detail: [a.area, a.fee].filter(Boolean).join(' · '),
          image: safeImageUrl(a.photoUrl),
          keywords: `academy coaching ${a.ageGroups || ''} ${a.batches.join(' ')}`,
          intent: { item: a.id },
        }),
      );
    }
    for (const e of visibleEvents(content?.events)) {
      out.push(
        item(`event-${e.id}`, 'Events', e.title, 'events', {
          detail: [eventDateText(e), e.venue].filter(Boolean).join(' · '),
          image: eventPhoto(e).desktop,
          keywords: `event ${e.category} ${e.summary || ''}`,
          intent: { item: e.id },
        }),
      );
    }
    return [...out, ...PAGE_ITEMS];
  }, [content, apparel, gettingServices, repairCategories]);
}

export interface SearchResultGroup {
  group: SearchGroup;
  items: SearchItem[];
}

const PER_GROUP = 5;

/** How well `item` matches the query tokens (0 = not a match). Every token must match somewhere. */
function score(it: SearchItem, tokens: string[], whole: string): number {
  const titleWords = it.titleText.split(' ');
  const otherWords = it.otherText.split(' ');
  let total = 0;
  for (const t of tokens) {
    if (titleWords.some((w) => w.startsWith(t))) total += 3;
    else if (t.length >= 3 && it.titleText.includes(t)) total += 2;
    else if (otherWords.some((w) => w.startsWith(t))) total += 1.5;
    else if (t.length >= 3 && it.otherText.includes(t)) total += 1;
    else return 0;
  }
  if (it.titleText === whole) total += 5;
  else if (it.titleText.startsWith(whole)) total += 3;
  // Joined forms: "bg80" for "BG 80", "astrox88d" for "Astrox 88D".
  else if (it.titleText.replace(/ /g, '').includes(whole.replace(/ /g, ''))) total += 1;
  return total;
}

/** Results for a query, grouped; the best-matching group first. */
export function searchIndex(index: SearchItem[], query: string): SearchResultGroup[] {
  const whole = normalise(query);
  if (!whole) return [];
  const tokens = whole.split(' ').filter(Boolean);
  const joined = whole.replace(/ /g, '');
  const byGroup = new Map<SearchGroup, { it: SearchItem; s: number }[]>();
  for (const it of index) {
    let s = score(it, tokens, whole);
    // Spaces don't matter: "bg80" finds "BG 80" and "bg 80" finds "BG80".
    if (!s && joined.length >= 3 && it.titleText.replace(/ /g, '').includes(joined)) s = 1.5;
    if (!s) continue;
    const list = byGroup.get(it.group) || [];
    list.push({ it, s });
    byGroup.set(it.group, list);
  }
  return [...byGroup.entries()]
    .map(([group, list]) => {
      list.sort((a, b) => b.s - a.s || a.it.title.localeCompare(b.it.title));
      return { group, best: list[0].s, items: list.slice(0, PER_GROUP).map((x) => x.it) };
    })
    .sort((a, b) => b.best - a.best || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    .map(({ group, items }) => ({ group, items }));
}

/** Address for a result (shown on hover, opens in a new tab with Ctrl/Cmd-click). */
export function searchHref(it: SearchItem): string {
  return PUBLIC_PAGES[it.page].path + (it.intent?.section ? `#${it.intent.section}` : '');
}
