/**
 * KATA Architecture - Environment Variables Configuration
 *
 * PROJECT-OWNED. `bun sync` never overwrites this file: every project adapts
 * its environments, its URLs, its credential map and its auth endpoints, and
 * that adaptation is the point.
 *
 * The synced half is `config/variables.core.ts`. It holds the `.env` bootstrap,
 * the Atlassian instance-resolver wiring, and the TMS / browser / reporting
 * blocks that synced code reads. Those used to live here, which meant an
 * adapted copy of this file stopped receiving resolver fixes — and the resolver
 * feeds `config.tms.jira.url`, the host the Jira-Direct TMS provider WRITES
 * results back onto. A stale host there does not fail loudly; it writes to the
 * wrong site in silence.
 *
 * WHAT TO EDIT HERE: `Environment`, `envDataMap`, `userCredentialsMap`, and the
 * `auth` block. Everything else is imported and should be changed upstream.
 *
 * Bun automatically loads .env files - no dotenv dependency needed.
 * But the Playwright VSCode extension requires reading process.env as Node.js,
 * so the core calls loadEnvFile() at import time.
 *
 * Usage:
 *   import { config, env } from '@variables';
 */

import {
  BROWSER_CONFIG,
  CORE_ENV,
  REPORTING_CONFIG,
  TMS_CONFIG,
} from './variables.core';

// ============================================
// Environment Type Definitions
// ============================================

export type Environment = 'local' | 'staging'; // Add more when needed (e.g., 'production')

// ============================================
// Test-User Credentials (variables from .env)
// Which variable holds which environment's credentials is project vocabulary,
// so the read stays here rather than in the synced core.
//
// Nothing validates these up front: not the installer, not the doctor, not the
// env schema, not `test:env:check`. The framework has no opinion on whether
// your app has a login. The one consumer that needs a value is `config.testUser`
// below, which throws a NAMED error the moment something reads it while the
// pair for the active environment is empty. The two auth setups in
// `tests/setup/` read it at t=0, so a missing credential is the first line of
// the run instead of an app-side login failure.
// ============================================

const {
  LOCAL_USER_EMAIL, // Used when TEST_ENV=local
  LOCAL_USER_PASSWORD, // Used when TEST_ENV=local
  STAGING_USER_EMAIL, // Used when TEST_ENV=staging
  STAGING_USER_PASSWORD, // Used when TEST_ENV=staging
  STAGING_ADMIN_EMAIL,
  STAGING_ADMIN_PASSWORD,
  STAGING_MEMBER_EMAIL,
  STAGING_MEMBER_PASSWORD,
  STAGING_VIEWER_EMAIL,
  STAGING_VIEWER_PASSWORD,
  STAGING_SUPABASE_URL, // Public client value (data API host), staging only
  STAGING_SUPABASE_ANON_KEY, // Public client value (anon/publishable key), staging only
} = process.env;

const userCredentialsMap: Record<Environment, { email: string, password: string }> = {
  local: {
    email: LOCAL_USER_EMAIL ?? '',
    password: LOCAL_USER_PASSWORD ?? '',
  },
  staging: {
    email: STAGING_USER_EMAIL ?? '',
    password: STAGING_USER_PASSWORD ?? '',
  },
};

/**
 * The names `.env` uses for each environment's pair, for the error message
 * only. Keep in step with the destructuring above when you rename them.
 */
const userCredentialVarNames: Record<Environment, { email: string, password: string }> = {
  local: { email: 'LOCAL_USER_EMAIL', password: 'LOCAL_USER_PASSWORD' },
  staging: { email: 'STAGING_USER_EMAIL', password: 'STAGING_USER_PASSWORD' },
};

// ============================================
// Workspace role accounts (multi-role tests)
// The Owner is the framework pair above; Admin, Member and Viewer are
// declared in .env.schema. Only staging has role accounts today.
// ============================================

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export const workspaceRoles: readonly WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

const roleCredentialVarNames: Record<WorkspaceRole, { email: string, password: string }> = {
  owner: userCredentialVarNames.staging,
  admin: { email: 'STAGING_ADMIN_EMAIL', password: 'STAGING_ADMIN_PASSWORD' },
  member: { email: 'STAGING_MEMBER_EMAIL', password: 'STAGING_MEMBER_PASSWORD' },
  viewer: { email: 'STAGING_VIEWER_EMAIL', password: 'STAGING_VIEWER_PASSWORD' },
};

const stagingRoleCredentialsMap: Record<WorkspaceRole, { email: string, password: string }> = {
  owner: userCredentialsMap.staging,
  admin: { email: STAGING_ADMIN_EMAIL ?? '', password: STAGING_ADMIN_PASSWORD ?? '' },
  member: { email: STAGING_MEMBER_EMAIL ?? '', password: STAGING_MEMBER_PASSWORD ?? '' },
  viewer: { email: STAGING_VIEWER_EMAIL ?? '', password: STAGING_VIEWER_PASSWORD ?? '' },
};

// ============================================
// Environment Detection
// ============================================

export const env = {
  ...CORE_ENV,
  current: CORE_ENV.current as Environment,
  isLocal: CORE_ENV.current === 'local',
  isStaging: CORE_ENV.current === 'staging',
} as const;

// ============================================
// ENV DATA Mapping (hardcoded - not secrets because these are not sensitive data like credentials)
// ============================================

const envDataMap: Record<
  Environment,
  { base: string, api: string, user: { email: string, password: string } }
> = {
  local: {
    base: 'http://localhost:3000',
    api: 'http://localhost:3000/api',
    user: userCredentialsMap.local,
  },
  staging: {
    base: 'https://staging-upexbunkai.vercel.app',
    api: 'https://staging-upexbunkai.vercel.app/api',
    user: userCredentialsMap.staging,
  },
};
// The point of use for TEST_ENV. A value this file does not declare used to
// crash on `undefined.base` a few lines down; now it says which variable, which
// value, and which names this project accepts.
function resolveEnvData(): (typeof envDataMap)[Environment] {
  const data: (typeof envDataMap)[Environment] | undefined = envDataMap[env.current];
  if (data === undefined) {
    throw new Error(
      `TEST_ENV=${String(env.current)} names an environment this project does not declare. `
      + `Valid values (config/variables.ts envDataMap): ${Object.keys(envDataMap).join(', ')}. `
      + 'Add the environment there (and to the Environment type) or fix TEST_ENV in .env.',
    );
  }
  return data;
}
const envData = resolveEnvData();

/**
 * The active environment's test user, read at the point of use.
 *
 * Throws a NAMED error when either half is empty, so an unset credential fails
 * on the first read (the `ui-setup` / `api-setup` projects, or `bun run
 * api:login`) with the variable names, instead of surfacing later as a login
 * rejected by the app under test. A project whose app has no login never reads
 * this and never sees the error: remove the setup projects from
 * `playwright.config.ts` and `testUser` is simply never touched.
 */
function readTestUser(): { email: string, password: string } {
  const user = envData.user;
  if (user.email !== '' && user.password !== '') { return user; }
  const names = userCredentialVarNames[env.current];
  const missing = [user.email === '' ? names.email : null, user.password === '' ? names.password : null]
    .filter((n): n is string => n !== null);
  throw new Error(
    `Test user for TEST_ENV=${env.current} is not set: ${missing.join(', ')} `
    + '(declared in config/variables.ts, values in .env). '
    + 'No login in your app? Remove the ui-setup / api-setup projects from playwright.config.ts.',
  );
}

/**
 * Credentials of one workspace role, read at the point of use.
 * Throws a NAMED error when the variables are empty or the environment has no role accounts.
 */
function readRoleUser(role: WorkspaceRole): { email: string, password: string } {
  if (env.current !== 'staging') {
    throw new Error(`Role accounts are only declared for TEST_ENV=staging (current: ${env.current}).`);
  }
  const user = stagingRoleCredentialsMap[role];
  if (user.email !== '' && user.password !== '') { return user; }
  const names = roleCredentialVarNames[role];
  const missing = [user.email === '' ? names.email : null, user.password === '' ? names.password : null]
    .filter((n): n is string => n !== null);
  throw new Error(`Credentials for role '${role}' are not set: ${missing.join(', ')} (values in .env).`);
}

/**
 * Whether every workspace role has its credentials set on staging. Never throws:
 * used by playwright.config.ts to decide if the role projects run at all.
 */
function hasRoleUsers(): boolean {
  if (env.current !== 'staging') { return false; }
  return workspaceRoles.every((role) => {
    const user = stagingRoleCredentialsMap[role];
    return user.email !== '' && user.password !== '';
  });
}

/**
 * Supabase data API coordinates (public client values), read at the point of use.
 * Throws a NAMED error when either is empty.
 */
function readDataApi(): { url: string, anonKey: string } {
  if (env.current !== 'staging') {
    throw new Error(`The Supabase data API is only declared for TEST_ENV=staging (current: ${env.current}).`);
  }
  const url = STAGING_SUPABASE_URL ?? '';
  const anonKey = STAGING_SUPABASE_ANON_KEY ?? '';
  const missing = [url === '' ? 'STAGING_SUPABASE_URL' : null, anonKey === '' ? 'STAGING_SUPABASE_ANON_KEY' : null]
    .filter((n): n is string => n !== null);
  if (missing.length > 0) {
    throw new Error(`Supabase data API config is not set: ${missing.join(', ')} (values in .env).`);
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

// ============================================
// Main Configuration Object
// ============================================

export const config = {
  // URLs - selected by TEST_ENV from urlMap
  baseUrl: envData.base,
  apiUrl: envData.api,

  // Authentication config (Bunkai API v1 endpoints - relative to apiUrl)
  auth: {
    loginEndpoint: '/v1/auth/signin',
    tokenEndpoint: '/v1/auth/signin', // Endpoint to intercept for token (used by page.waitForResponse)
    meEndpoint: '/v1/me',
    tokenLifetimeSeconds: 86400, // 24 hours (1 day)
    // Storage paths for authenticated sessions
    storageStatePath: '.auth/user.json',
    apiStatePath: '.auth/api-state.json',
    // Per-role cookie sessions written by the role-sessions-setup project
    roleStatePath: (role: WorkspaceRole): string => `.auth/role-${role}.json`,
    // Supabase access token of the role (data-API calls only); never inside storageState
    roleTokenPath: (role: WorkspaceRole): string => `.auth/role-${role}.token.json`,
  },

  // Test User (configure in .env). A getter: validated on first read, by name.
  get testUser(): { email: string, password: string } {
    return readTestUser();
  },

  // Credentials of a workspace role. A method: validated on call, by name.
  roleUser: readRoleUser,

  // True only on staging with all four role accounts set (presence check, never throws).
  hasRoleUsers,

  // Supabase data API (url + anon key). A getter: validated on first read, by name.
  get dataApi(): { url: string, anonKey: string } {
    return readDataApi();
  },

  // TMS / Browser / Reporting — synced (config/variables.core.ts)
  tms: TMS_CONFIG,
  browser: BROWSER_CONFIG,
  reporting: REPORTING_CONFIG,
} as const;
