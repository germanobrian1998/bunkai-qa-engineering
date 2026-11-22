import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DISPLAY_NAME_VIEWPORTS } from '@data/constants';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { test } from '@TestFixture';

test.describe('BK-1949: Longest display name layout', () => {
  let steps: DisplayNameSteps;
  let owner: DisplayNameSession;

  test.beforeAll(async ({ playwright }) => {
    steps = new DisplayNameSteps({ playwright });
    owner = await steps.openOwnerBrowserSession();
    await steps.capture(owner.api);
  });

  test.afterAll(async () => {
    await steps?.release();
  });

  test.afterEach(async () => {
    await owner.api.displayName.saveName(DataFactory.createDisplayName());
  });

  const names = {
    'with no break opportunity': 'W'.repeat(80),
    'with spaces': 'Elena '.repeat(14).slice(0, 80),
  };
  const rows = Object.entries(names).flatMap(([shape, name]) =>
    Object.entries(DISPLAY_NAME_VIEWPORTS).map(([device, viewport]) => ({ label: `${shape} on ${device}`, name, viewport })),
  );

  for (const { label, name, viewport } of rows) {
    test(
      `BK-2134: should render an 80-character name readable without overflow in the identity card and the banner when the longest accepted name is saved given a name ${label}`,
      { tag: ['@medium', '@regression'] },
      async ({ test: kata }) => {
        await steps.forBrowser(kata.page).displayName.saveName(name);

        await kata.ui.account.renderLongDisplayName({ name, viewport });
      },
    );
  }
});
