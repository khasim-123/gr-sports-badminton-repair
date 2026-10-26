import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopByProductSection, type ProductCategory } from './ShopByProductSection';

const category = (overrides: Partial<ProductCategory>): ProductCategory => ({
  key: 'rackets',
  name: 'Rackets',
  detail: '8 rackets',
  image: '/images/site/rackets-on-court.webp',
  onOpen: vi.fn(),
  ...overrides,
});

describe('ShopByProductSection', () => {
  it('is not shown when the shop has no catalogues', () => {
    const { container } = render(<ShopByProductSection categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one tile per catalogue with its live count, and each tile opens it', async () => {
    const openStrings = vi.fn();
    const openTshirts = vi.fn();
    render(
      <ShopByProductSection
        categories={[
          category({}),
          category({ key: 'strings', name: 'Strings', detail: '49 strings', image: '/images/site/strings-closeup.webp', onOpen: openStrings }),
          category({ key: 'tshirts', name: 'T-shirts & team wear', detail: 'Team orders', image: '/images/apparel/hero.webp', onOpen: openTshirts }),
        ]}
      />,
    );
    const section = screen.getByRole('region', { name: 'Shop by product' });
    const tiles = within(section).getAllByRole('button');
    expect(tiles.map((t) => t.textContent)).toEqual(['Rackets8 rackets', 'Strings49 strings', 'T-shirts & team wearTeam orders']);
    expect(tiles[0].querySelector('img')).toHaveAttribute('srcset', expect.stringContaining('/images/site/rackets-on-court-sm.webp 800w'));

    const user = userEvent.setup();
    await user.click(within(section).getByRole('button', { name: /Strings/ }));
    await user.click(within(section).getByRole('button', { name: /T-shirts & team wear/ }));
    expect(openStrings).toHaveBeenCalledTimes(1);
    expect(openTshirts).toHaveBeenCalledTimes(1);
  });

  it('slider: shows every tile as a photo card in one row, and each opens its page', async () => {
    const openAcademies = vi.fn();
    render(
      <ShopByProductSection
        id="sections"
        title="What you'll find at GR Sports"
        layout="slider"
        categories={[
          category({ key: 'badminton', name: 'Badminton', detail: 'Rackets, strings, stringing and repairs' }),
          category({ key: 'academies', name: 'Academies', detail: 'Book a slot', onOpen: openAcademies }),
        ]}
      />,
    );
    const section = screen.getByRole('region', { name: "What you'll find at GR Sports" });
    const row = within(section).getByRole('list');
    expect(within(row).getAllByRole('listitem')).toHaveLength(2);
    expect(row).toHaveClass('snap-x', 'overflow-x-auto');
    // jsdom has no layout, so nothing overflows: no arrows or pause button are needed.
    expect(within(section).queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    await userEvent.setup().click(within(row).getByRole('button', { name: /Academies/ }));
    expect(openAcademies).toHaveBeenCalledTimes(1);
  });

  describe('slider sliding on its own', () => {
    const scrollBy = vi.fn();
    beforeEach(() => {
      vi.useFakeTimers();
      scrollBy.mockReset();
      // jsdom has no layout: make the row wider than its box so it can slide.
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.tagName === 'UL' ? 1200 : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.tagName === 'UL' ? 400 : 0;
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: scrollBy });
      // The row is on screen.
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
          observe() {
            this.cb([{ isIntersecting: true }]);
          }
          disconnect() {}
        },
      );
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy;
    });

    const renderSlider = () => {
      render(
        <ShopByProductSection
          id="sections"
          title="What you'll find"
          layout="slider"
          categories={['badminton', 'tshirts', 'academies', 'events'].map((key) => category({ key, name: key }))}
        />,
      );
      return screen.getByRole('list').parentElement as HTMLElement;
    };
    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    // jsdom has no PointerEvent: give the event the mouse fields the slider reads.
    const mouseMove = (el: Element, movementX: number) => {
      const e = createEvent.pointerMove(el);
      Object.defineProperties(e, { pointerType: { value: 'mouse' }, movementX: { value: movementX }, movementY: { value: 0 } });
      fireEvent(el, e);
    };

    it('keeps sliding with the mouse resting on it, and waits while the mouse moves over it', () => {
      const area = renderSlider();
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      // The row scrolling in under a resting mouse is not the visitor pointing at it.
      fireEvent.mouseEnter(area);
      mouseMove(area, 0);
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(2);

      mouseMove(area, 6);
      wait(20000);
      expect(scrollBy).toHaveBeenCalledTimes(2);
      fireEvent.pointerLeave(area);
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(3);
    });

    it('slides on again a few seconds after the visitor uses the arrows', () => {
      const area = renderSlider();
      fireEvent.click(within(area).getByRole('button', { name: 'Next' }));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      wait(7900);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      wait(100);
      expect(scrollBy).toHaveBeenCalledTimes(2);
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(3);
    });

    it('on phones a sideways swipe holds it for a few seconds; scrolling the page past it does not', () => {
      const area = renderSlider();
      const row = within(area).getByRole('list');
      fireEvent.touchStart(row, { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchMove(row, { touches: [{ clientX: 195, clientY: 150 }] });
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(1);

      fireEvent.touchStart(row, { touches: [{ clientX: 300, clientY: 300 }] });
      fireEvent.touchMove(row, { touches: [{ clientX: 150, clientY: 310 }] });
      wait(4500);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      wait(3500);
      expect(scrollBy).toHaveBeenCalledTimes(2);
    });
  });
});
