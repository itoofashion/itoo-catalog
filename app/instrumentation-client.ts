import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Both values are inlined at build time, so a build made without them (a
// checkout with no .env.production, and every test run) simply carries no
// analytics: posthog.capture on an instance that was never initialised is a
// silent no-op, so nothing else has to know. Session replay itself is switched
// on in the PostHog project settings, not here.
if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}
