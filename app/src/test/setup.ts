import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest only auto-cleans when globals are enabled, and they are not here.
afterEach(cleanup);

// jsdom has no ResizeObserver; Radix positions tooltips with one. The tests
// never assert on measured positions, so a quiet stand-in is the whole need.
class QuietResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= QuietResizeObserver as unknown as typeof ResizeObserver;
