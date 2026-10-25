import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import { mediaQueryList } from '../../../test/mediaQuery';
import { HeroCarousel, type HeroSlide } from './HeroCarousel';

beforeAll(() => {
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

afterEach(() => {
  vi.useRealTimers();
});

const slides: HeroSlide[] = [
  { key: 'stringing', image: '/images/site/stringing.webp', alt: 'A racket being strung', title: 'Racket stringing at your door', text: 'Pickup and delivery.' },
  {
    key: 'event',
    image: '/images/site/tournament.webp',
    alt: 'Players at a tournament',
    eyebrow: 'Tournament',
    title: 'GR Sports Doubles Open 2026',
    meta: [{ icon: 'date', text: 'Sat 14 Nov' }],
    primary: { label: 'Register', onClick: vi.fn() },
  },
  { key: 'shop', image: '/images/site/shop.webp', alt: 'The shop counter', title: 'Visit the shop' },
];

const controls = () => screen.getByRole('group', { name: 'Slideshow controls' });
/** The headline of the slide that is showing (inactive slides are aria-hidden). */
const visibleTitle = () => screen.getByRole('heading', { level: 2 }).textContent;
/** A slide by its label, whether or not it is showing (hidden slides have no accessible name). */
const slide = (label: string) => {
  const el = document.querySelector(`[aria-roledescription="slide"][aria-label="${label}"]`);
  if (!el) throw new Error(`No slide labelled ${label}`);
  return el;
};

describe('HeroCarousel', () => {
  it('a single slide has no slideshow controls', () => {
    render(<HeroCarousel slides={[slides[0]]} />);

    expect(screen.getByRole('region', { name: 'Featured at GR Sports' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Racket stringing at your door' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Slideshow controls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing without slides', () => {
    const { container } = render(<HeroCarousel slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('with several slides the controls group has Previous, one dot per slide, Next and Pause', () => {
    render(<HeroCarousel slides={slides} />);

    const group = controls();
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Previous slide',
      'Show slide 1: Racket stringing at your door',
      'Show slide 2: GR Sports Doubles Open 2026',
      'Show slide 3: Visit the shop',
      'Next slide',
      'Pause slideshow',
    ]);
    expect(within(group).getByRole('button', { name: /Show slide 1/ })).toHaveAttribute('aria-current', 'true');
    expect(visibleTitle()).toBe('Racket stringing at your door');
    expect(slide('1 of 3: Racket stringing at your door')).toHaveAttribute('aria-hidden', 'false');
    expect(slide('2 of 3: GR Sports Doubles Open 2026')).toHaveAttribute('aria-hidden', 'true');
    expect(slide('3 of 3: Visit the shop')).toHaveAttribute('aria-hidden', 'true');
    // Assistive technology only finds the slide that is showing.
    expect(screen.getByRole('group', { name: '1 of 3: Racket stringing at your door' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '2 of 3: GR Sports Doubles Open 2026' })).not.toBeInTheDocument();
  });

  it('Next, Previous and the dots change the visible slide (wrapping around)', async () => {
    const user = userEvent.setup();
    render(<HeroCarousel slides={slides} />);

    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(visibleTitle()).toBe('GR Sports Doubles Open 2026');
    expect(slide('1 of 3: Racket stringing at your door')).toHaveAttribute('aria-hidden', 'true');
    expect(slide('2 of 3: GR Sports Doubles Open 2026')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('button', { name: /Show slide 2/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Show slide 1/ })).not.toHaveAttribute('aria-current');
    // The slide's details and action are reachable only while it shows.
    expect(screen.getByText('Sat 14 Nov')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show slide 3: Visit the shop' }));
    expect(visibleTitle()).toBe('Visit the shop');
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(visibleTitle()).toBe('Racket stringing at your door');

    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(visibleTitle()).toBe('Visit the shop');
  });

  it("calls the slide's action when its button is pressed", async () => {
    const user = userEvent.setup();
    render(<HeroCarousel slides={slides} />);

    await user.click(screen.getByRole('button', { name: /Show slide 2/ }));
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(slides[1].primary?.onClick).toHaveBeenCalledTimes(1);
  });

  it('the Pause button toggles to Play and back', async () => {
    const user = userEvent.setup();
    render(<HeroCarousel slides={slides} />);

    await user.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause slideshow' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play slideshow' }));
    expect(screen.getByRole('button', { name: 'Pause slideshow' })).toBeInTheDocument();
  });

  it('moves to the next slide on its own every 7 seconds', () => {
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);

    act(() => vi.advanceTimersByTime(6900));
    expect(visibleTitle()).toBe('Racket stringing at your door');
    act(() => vi.advanceTimersByTime(100));
    expect(visibleTitle()).toBe('GR Sports Doubles Open 2026');
    act(() => vi.advanceTimersByTime(7000));
    expect(visibleTitle()).toBe('Visit the shop');
  });

  // These use fireEvent: with fake timers, user-event's pointer would also hover/focus the carousel,
  // which pauses it by itself.
  it('does not move on its own once paused, and resumes on Play', () => {
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe('Racket stringing at your door');

    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    act(() => vi.advanceTimersByTime(7000));
    expect(visibleTitle()).toBe('GR Sports Doubles Open 2026');
  });

  it('holds still while the pointer is over it or focus is inside it', () => {
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);
    const region = screen.getByRole('region', { name: 'Featured at GR Sports' });

    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe('Racket stringing at your door');
    fireEvent.mouseLeave(region);

    act(() => screen.getByRole('button', { name: 'Next slide' }).focus());
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe('Racket stringing at your door');

    act(() => (document.activeElement as HTMLElement).blur());
    act(() => vi.advanceTimersByTime(7000));
    expect(visibleTitle()).toBe('GR Sports Doubles Open 2026');
  });

  it('with reduced motion there is no autoplay and no Pause button', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => mediaQueryList(q, q.includes('prefers-reduced-motion')));
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);

    expect(screen.queryByRole('button', { name: /Pause slideshow|Play slideshow/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(20000));
    expect(visibleTitle()).toBe('Racket stringing at your door');
  });

  it('while content loads it shows only the photo: no text and no controls', () => {
    render(<HeroCarousel slides={slides} placeholder />);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Slideshow controls' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'A racket being strung' })).toBeInTheDocument();
  });
});
