/**
 * Device-code sign-in: the handshake behind `warmbly auth login`. A tool with no
 * credential asks for a code, shows the user a short code and a URL, and polls until
 * a signed-in member approves it in the dashboard, which mints an ordinary API key
 * scoped to the permissions the tool asked for. Two public endpoints and a browser;
 * anything can drive it.
 */

import { resolveClientOptions } from "../core/config";
import { NotFoundError, WarmblyConnectionError, WarmblyError } from "../core/errors";
import { sleep } from "../core/fetch";
import { HttpClient } from "../core/http";
import type { ClientOptions } from "../core/types";
import { type PermissionInput, Permissions } from "../permissions";

/** Options for {@link DeviceAuth}. Only the connection settings apply: there is no token yet. */
export type DeviceAuthOptions = Pick<
  ClientOptions,
  "baseUrl" | "fetch" | "timeout" | "defaultHeaders"
>;

/** Body for {@link DeviceAuth.start}. */
export interface DeviceAuthorizationParams {
  /** The tool asking to sign in, shown on the approval page. */
  client_name: string;
  /** The machine the tool runs on, shown on the approval page and stored on the key. */
  hostname?: string;
  /** The tool's version, for the approval page. */
  cli_version?: string;
  /**
   * The permissions the minted key should carry: a bitmask, a `Permissions` set, or a
   * list of permission names or scope strings.
   */
  scopes: PermissionInput | PermissionInput[];
  [key: string]: unknown;
}

/** A started device authorization. Show `user_code` and open `verification_uri_complete`. */
export interface DeviceAuthorization {
  /** The secret the tool keeps and polls with. */
  device_code: string;
  /** The short code the user reads on the approval page. */
  user_code: string;
  /** The approval page. */
  verification_uri: string;
  /** The approval page with the code filled in. */
  verification_uri_complete: string;
  /** Seconds until the code expires. */
  expires_in: number;
  /** The minimum seconds between polls. */
  interval: number;
  [key: string]: unknown;
}

/** The lifecycle of a device authorization. `claimed` means the key was already fetched. */
export type DeviceAuthorizationStatus = "pending" | "approved" | "claimed" | "denied";

/**
 * A poll result. `token` and the identity fields are present exactly once, on the
 * first poll after approval.
 */
export interface DeviceAuthorizationPoll {
  status: DeviceAuthorizationStatus;
  /** The minted API key. Present once, on the approving poll. */
  token?: string;
  api_key_id?: string;
  scopes?: number;
  scope_names?: string[];
  user_id?: string;
  user_email?: string;
  user_name?: string;
  organization_id?: string;
  organization_name?: string;
  [key: string]: unknown;
}

/** Options for {@link DeviceAuth.waitForApproval}. */
export interface WaitForApprovalOptions {
  /** Aborts the wait. */
  signal?: AbortSignal;
  /** Called after every poll, with the status the server returned. */
  onPoll?: (poll: DeviceAuthorizationPoll) => void;
}

/**
 * The device-code sign-in flow. Public endpoints, per-IP rate limited, so a client
 * should poll no faster than the returned `interval`.
 *
 * @example
 * const device = new DeviceAuth();
 * const auth = await device.start({ client_name: "my-tool", scopes: ["read_campaigns"] });
 * console.log(`Open ${auth.verification_uri_complete} and confirm code ${auth.user_code}`);
 * const approved = await device.waitForApproval(auth);
 * const warmbly = new Warmbly({ apiKey: approved.token });
 */
export class DeviceAuth {
  private readonly http: HttpClient;

  constructor(options: DeviceAuthOptions = {}) {
    // No retries: a poll answers "approved" with the key exactly once, and a blind
    // retry after a lost response would report the code as already claimed.
    this.http = new HttpClient(resolveClientOptions({ ...options, maxRetries: 0 }));
  }

  /**
   * Starts a device authorization and returns the codes to show the user.
   * @example
   * const auth = await device.start({ client_name: "ci", hostname: os.hostname(), scopes: 3 });
   */
  start(params: DeviceAuthorizationParams): Promise<DeviceAuthorization> {
    const { scopes, ...rest } = params;
    const body = { ...rest, scopes: toScopeMask(scopes) };
    return this.http.post<DeviceAuthorization>("auth/cli/code", { body });
  }

  /**
   * Polls a device authorization once. An unknown or expired `device_code` is a 404.
   * @example
   * const poll = await device.poll(auth.device_code);
   * if (poll.status === "approved") console.log(poll.token);
   */
  poll(deviceCode: string): Promise<DeviceAuthorizationPoll> {
    return this.http.post<DeviceAuthorizationPoll>("auth/cli/poll", {
      body: { device_code: deviceCode },
    });
  }

  /**
   * Polls at the server's `interval` until the authorization is approved, then returns
   * the poll carrying the key. Throws a {@link DeviceAuthError} when it is denied, was
   * already claimed, or expires. Transient network failures are retried on the next tick.
   * @example
   * const { token, organization_name } = await device.waitForApproval(auth);
   */
  async waitForApproval(
    auth: Pick<DeviceAuthorization, "device_code" | "interval" | "expires_in">,
    options: WaitForApprovalOptions = {},
  ): Promise<DeviceAuthorizationPoll> {
    const intervalMs = Math.max(1, auth.interval) * 1000;
    const deadline = Date.now() + Math.max(0, auth.expires_in) * 1000;
    for (;;) {
      throwIfAborted(options.signal);
      let poll: DeviceAuthorizationPoll;
      try {
        poll = await this.poll(auth.device_code);
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new DeviceAuthError("expired", "The device code is unknown or has expired.", {
            cause: error,
          });
        }
        if (!(error instanceof WarmblyConnectionError)) throw error;
        poll = { status: "pending" };
      }
      options.onPoll?.(poll);
      switch (poll.status) {
        case "approved":
          return poll;
        case "denied":
          throw new DeviceAuthError("denied", "The sign-in was denied.");
        case "claimed":
          throw new DeviceAuthError(
            "claimed",
            "The device code was already claimed; its key was handed out to an earlier poll.",
          );
        default:
          break;
      }
      if (Date.now() + intervalMs > deadline) {
        throw new DeviceAuthError("expired", "The device code expired before it was approved.");
      }
      await sleepAbortable(intervalMs, options.signal);
    }
  }
}

/** Why a {@link DeviceAuth.waitForApproval} wait ended without a key. */
export type DeviceAuthFailure = "denied" | "claimed" | "expired" | "aborted";

/** Thrown when a device authorization ends without a key. */
export class DeviceAuthError extends WarmblyError {
  readonly failure: DeviceAuthFailure;

  constructor(failure: DeviceAuthFailure, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DeviceAuthError";
    this.failure = failure;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Normalizes the accepted scope inputs into the bitmask the endpoint takes. */
function toScopeMask(scopes: PermissionInput | PermissionInput[]): number {
  return Array.isArray(scopes) ? Permissions.from(...scopes).value : Permissions.from(scopes).value;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DeviceAuthError("aborted", "The device sign-in was aborted.");
}

/** Sleeps for `ms`, waking early (and throwing) when the signal aborts. */
async function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  throwIfAborted(signal);
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
  throwIfAborted(signal);
}
