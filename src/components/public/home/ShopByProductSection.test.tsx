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
});
