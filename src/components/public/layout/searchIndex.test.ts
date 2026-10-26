import { describe, expect, it } from 'vitest';
import { PAGE_ITEMS, normalise, searchHref, searchIndex, type SearchGroup, type SearchItem } from './searchIndex';

const make = (key: string, group: SearchGroup, title: string, other = ''): SearchItem => ({
  key,
  group,
  title,
  titleText: normalise(title),
  otherText: normalise(other),
  page: group === 'Strings' ? 'strings' : 'rackets',
  intent: { item: key },
});

const INDEX: SearchItem[] = [
  make('r1', 'Rackets', 'Yonex Astrox 88D Pro', 'Head Heavy Stiff'),
  make('r2', 'Rackets', 'Li-Ning Axforce 90 Max Dragon'),
  make('r3', 'Rackets', 'Victor Thruster Ryuga II Pro'),
  make('s1', 'Strings', 'Yonex BG 80', '0.68 mm white yellow'),
  make('s2', 'Strings', 'Hundred 66X Boost', 'black blue'),
  make('s3', 'Strings', 'Yonex BG80 Power'),
  ...PAGE_ITEMS,
];

const titles = (q: string) => searchIndex(INDEX, q).flatMap((g) => g.items.map((i) => i.title));

describe('site search', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise('  Li-Ning  BG-80 ')).toBe('li ning bg 80');
    expect(normalise('Café')).toBe('cafe');
  });

  it('finds a brand across rackets and strings, grouped', () => {
    const groups = searchIndex(INDEX, 'yonex');
    expect(groups.map((g) => g.group)).toEqual(['Rackets', 'Strings']);
    expect(titles('yonex')).toEqual(['Yonex Astrox 88D Pro', 'Yonex BG 80', 'Yonex BG80 Power']);
  });

  it('matches model names typed without spaces or with several words', () => {
    expect(titles('bg80')).toEqual(expect.arrayContaining(['Yonex BG 80', 'Yonex BG80 Power']));
    expect(titles('bg 80')).toEqual(expect.arrayContaining(['Yonex BG 80', 'Yonex BG80 Power']));
    expect(titles('astrox 88')).toEqual(['Yonex Astrox 88D Pro']);
    expect(titles('lining')).toContain('Li-Ning Axforce 90 Max Dragon');
  });

  it('every word must match', () => {
    expect(titles('yonex dragon')).toEqual([]);
  });

  it('finds pages by what people call them', () => {
    expect(titles('umpire')).toEqual(['Umpires for your tournament']);
    expect(titles('custom jersey')[0]).toBe('Custom T-shirts & jerseys');
    expect(titles('used racket')).toContain('Second-hand rackets');
    expect(titles('court')).toContain('Book a court');
    expect(searchIndex(INDEX, 'trophy')[0].items[0].intent).toEqual({ item: 'trophies' });
    expect(searchIndex(INDEX, 'repair')[0].items[0]).toMatchObject({ title: 'Book a racket repair', intent: { service: 'repair' } });
    expect(searchIndex(INDEX, 'restring')[0].items[0]).toMatchObject({ title: 'Book racket stringing', intent: { service: 'stringing' } });
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(searchIndex(INDEX, '   ')).toEqual([]);
    expect(searchIndex(INDEX, 'zzzz')).toEqual([]);
  });

  it('links each result to its page', () => {
    const custom = PAGE_ITEMS.find((p) => p.key === 'page-custom') as SearchItem;
    expect(searchHref(custom)).toBe('/tshirts#custom');
    expect(searchHref(INDEX[0])).toBe('/rackets');
  });
});
