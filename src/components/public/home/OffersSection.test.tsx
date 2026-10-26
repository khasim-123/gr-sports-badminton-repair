import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Banner } from '../../../types/content';
import { OffersSection } from './OffersSection';

const banner = (overrides: Partial<Banner>): Banner => ({
  id: 'BNR-1',
  title: 'Banner',
  subtitle: null,
  badge: null,
  ctaLabel: null,
  ctaTarget: 'none',
  ctaUrl: null,
  desktopImageUrl: '/images/site/strings-closeup.webp',
  mobileImageUrl: null,
  placement: 'promo',
  isActive: true,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-10-26T10:00:00Z',
  ...overrides,
});

describe('OffersSection', () => {
  it('shows nothing until the shop adds a promo banner or an announcement', () => {
    const { container } = render(<OffersSection promos={[]} announcements={[]} actionFor={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('skips a promo banner without a photo', () => {
    const { container } = render(
      <OffersSection promos={[banner({ desktopImageUrl: '' })]} announcements={[]} actionFor={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('runs promo banners as a slideshow with their label, text and button', async () => {
    const onClick = vi.fn();
    render(
      <OffersSection
        promos={[
          banner({ id: 'a', title: 'Hundred strings in up to 8 colours', badge: 'Strings', subtitle: 'Pick your colour when you book.' }),
          banner({ id: 'b', title: 'Team T-shirts and jerseys' }),
          banner({ id: 'c', title: 'Book a badminton court' }),
        ]}
        announcements={[]}
        actionFor={(b) => (b.id === 'a' ? { label: 'See strings', onClick } : undefined)}
      />,
    );
    const offers = screen.getByRole('region', { name: 'Offers and announcements' });
    const slideshow = within(offers).getByRole('region', { name: 'Offers' });
    expect(slideshow).toHaveAttribute('aria-roledescription', 'carousel');
    const slides = slideshow.querySelectorAll('[aria-roledescription="slide"]');
    expect([...slides].map((s) => s.getAttribute('aria-label'))).toEqual([
      '1 of 3: Hundred strings in up to 8 colours',
      '2 of 3: Team T-shirts and jerseys',
      '3 of 3: Book a badminton court',
    ]);
    // One banner at a time: the first is showing, with its label, text and button.
    expect(within(slideshow).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Hundred strings in up to 8 colours']);
    expect(within(slideshow).getByText('Strings')).toBeInTheDocument();
    expect(within(slideshow).getByText('Pick your colour when you book.')).toBeInTheDocument();
    expect(within(offers).queryByRole('heading', { name: 'Announcements' })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(slideshow).getByRole('button', { name: 'See strings' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.click(within(slideshow).getByRole('button', { name: 'Next slide' }));
    expect(within(slideshow).getByRole('heading', { level: 3 })).toHaveTextContent('Team T-shirts and jerseys');
    expect(within(slideshow).getByRole('button', { name: 'Pause slideshow' })).toBeInTheDocument();
  });

  it('a single promo banner stands still, without slideshow controls', () => {
    render(<OffersSection promos={[banner({ title: 'New string colours' })]} announcements={[]} actionFor={() => undefined} />);
    expect(screen.getByRole('heading', { level: 3, name: 'New string colours' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Slideshow controls' })).not.toBeInTheDocument();
  });

  it('shows announcements as notice cards, with or without a photo', () => {
    render(
      <OffersSection
        promos={[]}
        announcements={[
          banner({
            id: 'n1',
            placement: 'announcement',
            title: 'Shop closed on Sunday 1 November',
            subtitle: 'Pickups resume on Monday.',
            desktopImageUrl: '',
            endsAt: '2026-11-01',
          }),
          banner({ id: 'n2', placement: 'announcement', title: 'Doubles tournament', badge: 'Tournament' }),
        ]}
        actionFor={(b) => (b.id === 'n2' ? { label: 'Register', href: 'https://example.com/register', external: true } : undefined)}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Announcements' })).toBeInTheDocument();
    const [closed, tournament] = screen.getAllByRole('article');

    // No label given: "Announcement"; an end date is shown; no photo, no button.
    expect(within(closed).getByText('Announcement')).toBeInTheDocument();
    expect(within(closed).getByText('Pickups resume on Monday.')).toBeInTheDocument();
    expect(within(closed).getByText(/^Until /)).toHaveTextContent('Until Sun, 1 Nov');
    expect(within(closed).queryByRole('img')).not.toBeInTheDocument();
    expect(within(closed).queryByRole('link')).not.toBeInTheDocument();

    expect(within(tournament).getByText('Tournament')).toBeInTheDocument();
    expect(tournament.querySelector('img')).toHaveAttribute('src', '/images/site/strings-closeup.webp');
    const link = within(tournament).getByRole('link', { name: 'Register' });
    expect(link).toHaveAttribute('href', 'https://example.com/register');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
