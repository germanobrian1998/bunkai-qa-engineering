import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { test } from '@TestFixture';

test.describe('BK-1949: Display name refused values', () => {
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

  const blankRows = [
    { label: 'an empty string', hasName: true, value: '' },
    { label: 'five spaces', hasName: true, value: ' '.repeat(5) },
    { label: 'three non-breaking spaces', hasName: true, value: '\u00A0'.repeat(3) },
    { label: 'an ideographic space', hasName: true, value: '\u3000' },
    { label: 'three zero-width spaces', hasName: true, value: '\u200B'.repeat(3) },
    { label: 'a word joiner and a byte order mark', hasName: true, value: '\u2060\uFEFF' },
    { label: 'a tab, a space and a newline', hasName: true, value: '\t \n' },
    { label: 'an empty string and no saved name', hasName: false, value: '' },
    { label: 'five spaces and no saved name', hasName: false, value: ' '.repeat(5) },
  ];

  for (const { label, hasName, value } of blankRows) {
    test(
      `BK-2105: should refuse the save with 'The display name cannot be empty.' and keep the previous name when the value is blank after trimming given ${label}`,
      { tag: ['@high', '@regression'] },
      async () => {
        const unchangedName = hasName ? DataFactory.createDisplayName() : null;
        if (unchangedName === null) {
          await admin.api.displayName.removeName();
        }
        else {
          await admin.api.displayName.saveName(unchangedName);
        }

        await admin.api.displayName.refuseBlankDisplayName({ value, unchangedName });
      },
    );
  }

  const rawCapProbe = `${' '.repeat(996)}Elena`;

  const longRows = [
    { label: '81 code points', value: 'A'.repeat(81) },
    { label: '81 emoji', value: '\u{1F600}'.repeat(81) },
    { label: '81 combining marks', value: `e${'\u0301'.repeat(80)}` },
    { label: '1001 raw characters', value: rawCapProbe },
  ];

  for (const { label, value } of longRows) {
    test(
      `BK-2107: should refuse the save with 'The name must be at most 80 characters.' and keep the previous name when the value exceeds 80 code points or 1000 raw characters given ${label}`,
      { tag: ['@high', '@regression'] },
      async () => {
        const unchangedName = DataFactory.createDisplayName();
        await admin.api.displayName.saveName(unchangedName);

        await admin.api.displayName.refuseTooLongDisplayName({ value, unchangedName });
      },
    );
  }
});
