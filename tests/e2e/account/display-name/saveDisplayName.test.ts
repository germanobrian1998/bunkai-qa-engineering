import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.describe('BK-1949: Set a display name from Settings', () => {
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

  test(
    'BK-2100: should save the name and show it next to the email, confirming \'Your display name was saved.\' when the account has no own name',
    { tag: ['@critical', '@smoke', '@regression'] },
    async ({ test: kata }) => {
      const browserApi = steps.forBrowser(kata.page);
      await browserApi.displayName.removeName();
      const name = DataFactory.createDisplayName();
      await kata.ui.account.gotoSettings();

      await kata.ui.account.saveDisplayNameSuccessfully({ name, email: config.testUser.email });

      expect(await browserApi.displayName.readStoredName()).toBe(name);
    },
  );
});
