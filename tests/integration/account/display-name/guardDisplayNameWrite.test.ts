import type { DisplayNameSession } from '@steps/DisplayNameSteps';
import { DataFactory } from '@DataFactory';
import { DisplayNameSteps } from '@steps/DisplayNameSteps';
import { expect, test } from '@TestFixture';
import { config } from '@variables';

test.describe('BK-1949: Display name write guards', () => {
  let steps: DisplayNameSteps;
  let admin: DisplayNameSession;
  let member: DisplayNameSession;
  let anonymous: DisplayNameSession;
  let bearerOnly: DisplayNameSession;
  let cookieWithBearer: DisplayNameSession;

  test.beforeAll(async ({ playwright }) => {
    steps = new DisplayNameSteps({ playwright });
    admin = await steps.openRoleSession('admin');
    member = await steps.openRoleSession('member');
    await steps.capture(admin.api);
    await steps.capture(member.api);
    anonymous = await steps.openAnonymous();
    const pat = await steps.mintPat(admin);
    bearerOnly = await steps.openBearerOnly(pat.token);
    cookieWithBearer = await steps.openCookieWithBearer({ role: 'admin', token: pat.token });
  });

  test.afterAll(async () => {
    await steps?.release();
  });

  const verbs = ['PUT', 'DELETE'] as const;

  for (const verb of verbs) {
    test(
      `BK-2117: should refuse the write with 401 'Authentication required.' and write nothing when the request carries no cookie and no bearer token given a ${verb}`,
      { tag: ['@critical', '@regression'] },
      async () => {
        const savedName = DataFactory.createDisplayName();
        await admin.api.displayName.saveName(savedName);

        await anonymous.api.displayName.refuseWriteWithoutCredentials({ verb, displayName: DataFactory.createDisplayName() });

        expect(await admin.api.displayName.readStoredName()).toBe(savedName);
      },
    );
  }

  for (const verb of verbs) {
    for (const credentials of ['a personal access token alone', 'a personal access token and a valid cookie'] as const) {
      test(
        `BK-2118: should refuse the write with 403 'Personal access tokens cannot change identity details. Use a browser session.' when the request carries a personal access token given a ${verb} with ${credentials}`,
        { tag: ['@critical', '@regression'] },
        async () => {
          const savedName = DataFactory.createDisplayName();
          await admin.api.displayName.saveName(savedName);
          const caller = credentials === 'a personal access token alone' ? bearerOnly : cookieWithBearer;

          await caller.api.displayName.refuseWriteWithPersonalAccessToken({ verb, displayName: DataFactory.createDisplayName() });

          expect(await admin.api.displayName.readStoredName()).toBe(savedName);
        },
      );
    }
  }

  const extraFieldRows = [
    { label: 'a user id of another account', withEmail: false },
    { label: 'a user id and an email of another account', withEmail: true },
  ];

  for (const { label, withEmail } of extraFieldRows) {
    test(
      `BK-2119: should write only the signed-in account name when the body names another user or extra fields given a cookie session and ${label}`,
      { tag: ['@critical', '@regression'] },
      async () => {
        const nameA = DataFactory.createDisplayName();
        await member.api.displayName.saveName(nameA);
        await admin.api.displayName.saveName(DataFactory.createDisplayName());
        const { id: idA } = await member.api.displayName.readIdentity();
        const extraFields = withEmail
          ? { user_id: idA, email: config.roleUser('member').email }
          : { user_id: idA };

        await admin.api.displayName.writeOnlyOwnDisplayName({
          newName: DataFactory.createDisplayName(),
          extraFields,
          expectedEmail: config.roleUser('admin').email,
        });

        expect(await member.api.displayName.readStoredName()).toBe(nameA);
      },
    );
  }
});
