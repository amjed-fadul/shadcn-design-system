import { setImmediate } from "node:timers"
import { beforeEach } from "vitest"

// Contract tests run seconds of synchronous work each, and Vitest advances
// between tests with microtasks only. Without a macrotask turn the worker can't
// read the runner's RPC replies, so a long run of such tests trips Vitest's
// 60 second worker RPC timeout ("Timeout calling onTaskUpdate"). Only the node
// environment needs the yield; in jsdom it can stall behind pending DOM work.
if (typeof document === "undefined") {
  beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)))
}
