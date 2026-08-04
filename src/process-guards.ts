/**
 * Process-level resilience guards for MCP servers.
 *
 * Why this exists: these servers hold long-lived SSE connections. When a client
 * disappears abruptly (browser closed, connector reconnect, network blip) the socket
 * write fails with ECONNRESET / EPIPE. If that error surfaces from a promise with no
 * catch, Node 18+ treats it as an unhandled rejection and KILLS THE PROCESS.
 *
 * Observed in production: fireflies-mcp and cloudflare-mcp-server both went to
 * CRASHED with exactly this, after logging their normal startup line:
 *   code: 'ECONNRESET'
 *   node:internal/process/promises:288  triggerUncaughtException(err, true)
 *
 * An MCP server must not die because a client closed a window.
 *
 * Deliberately NOT a blanket catch-all: only errors we can positively identify as
 * benign socket teardown are swallowed. Anything else is still fatal, because a
 * process left running in an unknown state after a real bug is worse than a restart.
 */

const BENIGN_NET_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ERR_STREAM_WRITE_AFTER_END",
  "ERR_STREAM_DESTROYED",
  "ECONNABORTED",
]);

function codeOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export function installProcessGuards(serviceName: string): void {
  process.on("unhandledRejection", (reason) => {
    const code = codeOf(reason);
    if (code && BENIGN_NET_CODES.has(code)) {
      console.error(`[${serviceName}] benign socket teardown (${code}) - ignored`);
      return;
    }
    // Log loudly but stay alive: an unhandled rejection should not take the fleet down.
    console.error(`[${serviceName}] UNHANDLED REJECTION:`, describe(reason));
    if (reason instanceof Error && reason.stack) console.error(reason.stack);
  });

  process.on("uncaughtException", (err) => {
    const code = codeOf(err);
    if (code && BENIGN_NET_CODES.has(code)) {
      console.error(`[${serviceName}] benign socket teardown (${code}) - ignored`);
      return;
    }
    // Genuinely unexpected: log, then exit so the platform restarts us cleanly
    // rather than leaving a half-broken process serving traffic.
    console.error(`[${serviceName}] UNCAUGHT EXCEPTION - exiting:`, describe(err));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  });

  console.error(`[${serviceName}] process guards installed`);
}

/**
 * Attach error handlers to a single SSE response so a dead client cannot raise an
 * unhandled error. Call this right after creating the SSE transport, e.g.:
 *
 *   app.get("/sse", requireBearer(BASE_URL), async (req, res) => {
 *     guardSseSocket(req, res, "sse");
 *     ...
 *   });
 */
export function guardSseSocket(
  req: { socket?: { on?: (ev: string, cb: (e: unknown) => void) => void } },
  res: { on?: (ev: string, cb: (e: unknown) => void) => void },
  label = "sse"
): void {
  const swallow = (where: string) => (err: unknown) => {
    const code = codeOf(err);
    if (code && BENIGN_NET_CODES.has(code)) return;
    console.error(`[${label}] ${where} error:`, describe(err));
  };
  try {
    res.on?.("error", swallow("response"));
    req.socket?.on?.("error", swallow("socket"));
  } catch {
    /* never let the guard itself throw */
  }
}
