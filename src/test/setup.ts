/**
 * Vitest setup (runs before every test file): jest-dom matchers, DOM cleanup between tests,
 * and stand-ins for the browser APIs jsdom doesn't implement but the components use.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { mediaQueryList } from './mediaQuery';

// findBy* / waitFor: allow for a busy machine (debounced server checks take 250 ms).
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// No media query matches by default (tests that need one, e.g. reduced motion, spy on matchMedia).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => mediaQueryList(query),
  });
}

// Observers: the components only use them to pause/hide things when off screen, so a silent stub is enough.
class StubIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
if (typeof window.IntersectionObserver === 'undefined') {
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, writable: true, value: StubIntersectionObserver });
}

class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof window.ResizeObserver === 'undefined') {
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: StubResizeObserver });
}

// Scrolling is a no-op in jsdom (and window.scrollTo logs "Not implemented").
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
window.scrollTo = (() => {}) as typeof window.scrollTo;

if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}
