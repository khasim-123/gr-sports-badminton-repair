import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// The shop and its customers are in India and the app works with local calendar dates.
// Pin the zone so date-based tests give the same result on any machine (CI, laptops abroad).
process.env.TZ = 'Asia/Kolkata';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // Screen tests type like a person does; leave headroom for slow CI machines.
      testTimeout: 15000,
      // Mock call history is cleared and vi.spyOn spies are restored after every test.
      clearMocks: true,
      restoreMocks: true,
    },
  }),
);
