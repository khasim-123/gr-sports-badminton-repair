/** A MediaQueryList stand-in (jsdom has no matchMedia). Pass `matches` to simulate e.g. reduced motion. */
export function mediaQueryList(query: string, matches = false): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
}
