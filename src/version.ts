/**
 * The current version of the warmbly SDK, sent in the User-Agent on every request.
 * Must equal the `version` in package.json; `version.test.ts` fails the build if it
 * drifts, which it silently did through the 0.2.0 release.
 */
export const VERSION = "0.3.0";
