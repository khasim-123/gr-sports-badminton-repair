import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import type { SitePage } from '../../../types/content';
import { SiteFooter } from './SiteFooter';

vi.mock('../../../services/contentService', () => ({ contentService: { getShopSettings: vi.fn() } }));

const HIGHLIGHTS = ['24-Hour Stringing SLA: Electronic constant-pull machines', '100% Genuine Tag: Authorized brand importer source'];

function renderFooter(pages: SitePage[] = [], showStaffLinks = true) {
  const props = { pages, onOpenPage: vi.fn(), onTracking: vi.fn(), onStaffLogin: vi.fn(), showStaffLinks };
  render(<SiteFooter {...props} />);
  return { ...props, user: userEvent.setup() };
}

afterEach(() => primeShopSettings(DEFAULT_SHOP_SETTINGS));

describe('SiteFooter', () => {
  it('shows the shop’s highlight lines and social links from the shop settings', () => {
    primeShopSettings({
      ...DEFAULT_SHOP_SETTINGS,
      instagramUrl: 'https://instagram.com/grsports',
      youtubeUrl: 'http://youtube.com/not-https',
      footerHighlights: HIGHLIGHTS,
    });
    renderFooter();

    for (const line of HIGHLIGHTS) expect(screen.getByText(line)).toBeInTheDocument();
    const socials = screen.getByRole('list', { name: 'Social media' });
    expect(within(socials).getAllByRole('link')).toHaveLength(1); // only https links are shown
    expect(within(socials).getByRole('link', { name: 'GR Sports on Instagram' })).toHaveAttribute('href', 'https://instagram.com/grsports');
  });

  it('shows no highlights or social icons when none are set', () => {
    primeShopSettings(DEFAULT_SHOP_SETTINGS);
    renderFooter();
    expect(screen.queryByRole('list', { name: 'Social media' })).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA/)).not.toBeInTheDocument();
  });

  it('links footer pages only once they have text, and opens the staff logins', async () => {
    const { user, onStaffLogin } = renderFooter([
      { slug: 'shipping', title: 'Shipping', body: 'We deliver across Visakhapatnam.' },
      { slug: 'about', title: 'About us', body: '   ' },
    ]);
    expect(screen.getByRole('button', { name: 'Shipping' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About us' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Admin login' }));
    expect(onStaffLogin).toHaveBeenCalledWith('ADMIN');
  });
});
