/**
 * Device-code sign-in: the handshake behind `warmbly auth login`. A tool with no
 * credential shows a short code, a signed-in member approves it in the dashboard, and
 * the tool receives an API key scoped to what it asked for. Works against a self-hosted
 * instance too: pass baseUrl, and read websocket_url/app_url from misc.authConfig().
 * Run with: npx tsx examples/device-auth.ts
 */
import { hostname } from "node:os";
import { DeviceAuth, DeviceAuthError, Warmbly } from "warmbly";

const baseUrl = process.env.WARMBLY_BASE_URL; // e.g. https://warmbly.acme.internal/v1
const device = new DeviceAuth(baseUrl ? { baseUrl } : {});

// 1. Ask for a code, naming the tool and the permissions the key should carry.
const auth = await device.start({
  client_name: "example-tool",
  hostname: hostname(),
  scopes: ["read_campaigns", "read_contacts", "realtime_subscribe"],
});
console.log(`Open ${auth.verification_uri_complete}`);
console.log(`and confirm the code ${auth.user_code} (expires in ${auth.expires_in}s)`);

// 2. Poll at the server's interval until a member approves. The key arrives exactly once.
try {
  const approved = await device.waitForApproval(auth, {
    onPoll: (poll) => console.log("status:", poll.status),
  });
  console.log(`signed in as ${approved.user_email} in ${approved.organization_name}`);

  // 3. Use the key like any other, and discover the deployment's URLs when self-hosted.
  const warmbly = new Warmbly({ apiKey: approved.token, ...(baseUrl ? { baseUrl } : {}) });
  const me = await warmbly.misc.me();
  console.log("scopes", me.scopes);
  const config = await warmbly.misc.authConfig();
  if (config.self_hosted) console.log("gateway", config.websocket_url, "dashboard", config.app_url);

  // 4. Sign out: revoke the key the client is using. Needs no scope at all.
  await warmbly.apiKeys.revokeSelf("example finished");
  console.log("key revoked");
} catch (err) {
  if (err instanceof DeviceAuthError) console.error("sign-in ended:", err.failure, err.message);
  else throw err;
}
