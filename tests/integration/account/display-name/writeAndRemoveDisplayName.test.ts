import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { test } from '@TestFixture';

test.describe('BK-1949: Display name write and remove lifecycle', () => {
  let steps: DisplayNameSteps;
  let admin: DisplayNameSession;

  test.beforeAll(async ({ playwright }) => {
    steps = new DisplayNameSteps({ playwright });
    admin = await steps.openRoleSession('admin');
    await steps.capture(admin.api);
  });

  test.afterAll(async () => {
    await steps?.release();
  });

  test(
    'BK-2122: should answer 200 with the stored name and expose it in GET /me when the name is written and removed through the API given a cookie session',
    { tag: ['@high', '@regression'] },
    async () => {
      await admin.api.displayName.writeAndRemoveDisplayNameSuccessfully({ newName: DataFactory.createDisplayName() });
    },
  );
});
