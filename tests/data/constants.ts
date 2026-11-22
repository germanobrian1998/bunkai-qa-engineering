import type { RunRecipe } from '@data/types';

export const RUN_REPORT_PAGE_SIZE = 50;

export const RUN_FIXTURES = {
  main: {
    slug: 'qa-bk-225-fixture-20261117',
    recipe: {
      human: { passed: 7, failed: 3, aborted: 1 },
      agent: { passed: 20, failed: 6, aborted: 1 },
      ci: { passed: 20, failed: 5, aborted: 1 },
    },
  },
  manualOnly: {
    slug: 'qa-bk-225-fixture-20261117-manual-only',
    recipe: {
      human: { passed: 3, failed: 2, aborted: 4 },
      agent: { passed: 1, failed: 1 },
      ci: { aborted: 1 },
    },
  },
  automatedOnly: {
    slug: 'qa-bk-225-fixture-20261117-automated-onl',
    recipe: {
      agent: { passed: 2 },
      ci: { passed: 1 },
    },
  },
  empty: {
    slug: 'kata-bk225-empty-runs',
    recipe: {},
  },
} satisfies Record<string, { slug: string, recipe: RunRecipe }>;
