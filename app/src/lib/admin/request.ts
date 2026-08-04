import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isTeamSession, readAdminConfig } from "./auth";

/**
 * The one place a page asks whether it is being rendered for the team.
 *
 * Kept apart from auth.ts so the rules themselves stay plain functions that a
 * test can call with a config and a clock, instead of needing a request.
 */
export async function isTeamViewer(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return isTeamSession(token, readAdminConfig(), new Date());
}
