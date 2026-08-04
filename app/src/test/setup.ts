import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest only auto-cleans when globals are enabled, and they are not here.
afterEach(cleanup);
