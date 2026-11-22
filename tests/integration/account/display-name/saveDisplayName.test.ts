import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { test } from '@TestFixture';

test.describe('BK-1949: Display name accepted values', () => {
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

  test.afterEach(async () => {
    await admin.api.displayName.saveName(DataFactory.createDisplayName());
  });

  const rows = [
    { label: '1 code point', value: 'E', expectedStored: 'E' },
    { label: '79 code points', value: 'A'.repeat(79), expectedStored: 'A'.repeat(79) },
    { label: '80 code points', value: 'A'.repeat(80), expectedStored: 'A'.repeat(80) },
    { label: '80 emoji', value: '\u{1F600}'.repeat(80), expectedStored: '\u{1F600}'.repeat(80) },
    { label: '80 combining marks', value: `e${'\u0301'.repeat(79)}`, expectedStored: `e${'\u0301'.repeat(79)}` },
    { label: '80 code points with outer spaces', value: `   ${'A'.repeat(80)}   `, expectedStored: 'A'.repeat(80) },
  ];

  for (const { label, value, expectedStored } of rows) {
    test(
      `BK-2106: should accept and store the name in full when it has 1 to 80 code points after trimming given ${label}`,
      { tag: ['@high', '@regression'] },
      async () => {
        await admin.api.displayName.saveName(DataFactory.createDisplayName());
        await admin.api.displayName.saveDisplayNameWithinBounds({ value, expectedStored });
      },
    );
  }
});
