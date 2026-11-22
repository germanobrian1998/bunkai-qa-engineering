import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { test } from '@TestFixture';

test.describe('BK-1949: Home greets with the saved display name', () => {
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

  const generatedName = DataFactory.createDisplayName();
  const rows = [
    { label: 'an ordinary name', savedName: generatedName, greeting: `Welcome back, ${generatedName}.` },
    { label: 'bold markup', savedName: '<b>Elena</b>', greeting: 'Welcome back, <b>Elena</b>.' },
    { label: 'image markup', savedName: '<img src=x>', greeting: 'Welcome back, <img src=x>.' },
    { label: 'an email address', savedName: 'elena@example.com', greeting: 'Welcome back, elena@example.com.' },
    { label: 'a URL', savedName: 'https://example.com', greeting: 'Welcome back, https://example.com.' },
  ];

  for (const { label, savedName, greeting } of rows) {
    test(
      `BK-2101: should greet on Home with the full saved name as literal plain text when a display name is saved given ${label}`,
      { tag: ['@critical', '@regression'] },
      async ({ test: kata }) => {
        await steps.forBrowser(kata.page).displayName.saveName(savedName);

        await kata.ui.account.greetWithSavedName({ savedName, greeting });
      },
    );
  }
});
