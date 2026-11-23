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

export const DISPLAY_NAME_MESSAGES = {
  empty: 'The display name cannot be empty.',
  tooLong: 'The name must be at most 80 characters.',
  saved: 'Your display name was saved.',
  unauthenticated: 'Authentication required.',
  patForbidden: 'Personal access tokens cannot change identity details. Use a browser session.',
} as const;

export const DISPLAY_NAME_VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
} as const;

export const TEST_LIFECYCLE = {
  archiveReason: 'test_archived',
  versionConflictReason: 'version_conflict',
  titleRequiredReason: 'title_required',
  titleTooLongReason: 'title_too_long',
  titleRequiredMessage: 'A Test needs a name.',
  maxTitleLength: 200,
  blankTitles: {
    empty: '',
    spaces: '   ',
    tabs: '\t\t',
    nonBreakingSpaces: '\u00A0\u00A0',
  },
  characters: { ascii: 'a', accented: 'é', emoji: '😀' },
} as const;

export const TEST_LIFECYCLE_FIXTURE = {
  qaWorkspaceName: 'QA Bunkai',
  workspaceName: 'QA Kata BK-596',
  workspaceSlug: 'qa-kata-bk596',
  projectNamePrefix: 'kata-bk596',
} as const;
