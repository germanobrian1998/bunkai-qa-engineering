/**
 * Remaining lifetime, in seconds, of a personal access token (PAT).
 *
 * Shared by the API and UI auth setups so both write the same `expiresIn`
 * into the stored API state. A null, missing or unparseable `expiresAt` returns
 * `fallbackSeconds` (the configured token lifetime) instead of NaN: the stored
 * state always carries a finite lifetime, even for a PAT that never expires.
 *
 * @param expiresAt - ISO date-time the PAT expires at (null: no expiry reported)
 * @param fallbackSeconds - lifetime to use when `expiresAt` cannot be read
 */
export function patLifetimeSeconds(expiresAt: string | null | undefined, fallbackSeconds: number): number {
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (Number.isNaN(expiresAtMs)) {
    return fallbackSeconds;
  }
  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
}
