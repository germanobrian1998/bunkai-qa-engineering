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
  titleRequiredReason: 'title_required',
  titleTooLongReason: 'title_too_long',
  titleRequiredMessage: 'A Test needs a name.',
  blankTitles: {
    empty: '',
    spaces: '   ',
    tabs: '\t\t',
    nonBreakingSpaces: '\u00A0\u00A0',
  },
  characters: { ascii: 'a', accented: 'é', emoji: '😀' },
  archivedReason: 'test_archived',
  versionConflictReason: 'version_conflict',
  seedTags: ['bk596-seed'],
  frozenTags: ['bk596-frozen'],
  staleTags: ['bk596-stale'],
} as const;

export const PLAN_TEARDOWN = {
  verdict: 'passed',
  summary: 'kata teardown: fixture plan closed by automated cleanup',
} as const;

export const ACTIVE_WORKSPACE_COOKIE = 'bk_active_ws';

export const TEST_LIFECYCLE_FIXTURE = {
  workspaceName: 'QA Kata Test Lifecycle',
  workspaceSlug: 'qa-kata-test-lifecycle',
  projectName: 'kata-bk596',
  moduleName: 'Kata scaffold module',
  storyTitle: 'Kata scaffold story',
  criterionTitle: 'Kata scaffold criterion',
  atcTitle: 'Kata scaffold ATC',
  environmentName: 'kata-bk596-env',
} as const;

export const TEST_LIFECYCLE_FOREIGN_FIXTURE = {
  workspaceName: 'QA Kata BK-596',
} as const;

export const FROZEN_RENAME_ROW = {
  kind: 'rename',
  label: 'a rename',
  expectedStatus: 409,
  expectedCode: 'conflict',
  expectedReason: TEST_LIFECYCLE.archivedReason,
  watchedActions: ['test.renamed'],
} as const;

export const FROZEN_WRITE_ROWS = [
  { kind: 'reorder', label: 'a chain reorder', expectedStatus: 409, expectedCode: 'conflict', expectedReason: TEST_LIFECYCLE.archivedReason },
  { kind: 'tags', label: 'a tag change', expectedStatus: 409, expectedCode: 'conflict', expectedReason: TEST_LIFECYCLE.archivedReason },
] as const;

export type FrozenWriteRow = typeof FROZEN_RENAME_ROW | (typeof FROZEN_WRITE_ROWS)[number];

export const VIEWER_WRITE_ROWS = [
  { action: 'rename', state: 'live', label: 'a rename of a live Test', expectedStatus: 403, expectedCode: 'forbidden' },
  { action: 'archive', state: 'live', label: 'an archive of a live Test', expectedStatus: 403, expectedCode: 'forbidden' },
  { action: 'restore', state: 'archived', label: 'a restore of an archived Test', expectedStatus: 403, expectedCode: 'forbidden' },
] as const;

export type ViewerWriteRow = (typeof VIEWER_WRITE_ROWS)[number];

export const NON_MEMBER_ROWS = [
  { state: 'live', label: 'a live Test', expectedStatus: 404, expectedCode: 'not_found', ownerFinds: true },
  { state: 'archived', label: 'an archived Test', expectedStatus: 404, expectedCode: 'not_found', ownerFinds: false },
] as const;

export type NonMemberRow = (typeof NON_MEMBER_ROWS)[number];

export const TITLE_LENGTH_ROWS = [
  { label: '199 ASCII characters', endpoint: 'rename', character: TEST_LIFECYCLE.characters.ascii, count: 199, expectedStatus: 200, expectedCode: null, expectedReason: null },
  { label: '200 ASCII characters', endpoint: 'rename', character: TEST_LIFECYCLE.characters.ascii, count: 200, expectedStatus: 200, expectedCode: null, expectedReason: null },
  { label: '201 ASCII characters', endpoint: 'rename', character: TEST_LIFECYCLE.characters.ascii, count: 201, expectedStatus: 422, expectedCode: 'validation_failed', expectedReason: TEST_LIFECYCLE.titleTooLongReason },
  { label: '200 accented characters', endpoint: 'rename', character: TEST_LIFECYCLE.characters.accented, count: 200, expectedStatus: 200, expectedCode: null, expectedReason: null },
  { label: '200 emoji', endpoint: 'rename', character: TEST_LIFECYCLE.characters.emoji, count: 200, expectedStatus: 200, expectedCode: null, expectedReason: null },
  { label: '201 emoji', endpoint: 'rename', character: TEST_LIFECYCLE.characters.emoji, count: 201, expectedStatus: 422, expectedCode: 'validation_failed', expectedReason: TEST_LIFECYCLE.titleTooLongReason },
  { label: '200 emoji', endpoint: 'create', character: TEST_LIFECYCLE.characters.emoji, count: 200, expectedStatus: 201, expectedCode: null, expectedReason: null },
  { label: '201 emoji', endpoint: 'create', character: TEST_LIFECYCLE.characters.emoji, count: 201, expectedStatus: 422, expectedCode: 'validation_failed', expectedReason: TEST_LIFECYCLE.titleTooLongReason },
] as const;

export type TitleLengthRow = (typeof TITLE_LENGTH_ROWS)[number];

export const TAG_FILTER_ROWS = [
  { label: 'a tag shared with three live siblings', carriedBy: 'shared', expectedRemaining: 3 },
  { label: 'a tag only the archived Test carries', carriedBy: 'solo', expectedRemaining: 0 },
] as const;

export type TagFilterRow = (typeof TAG_FILTER_ROWS)[number];
