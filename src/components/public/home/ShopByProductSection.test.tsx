import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
});
