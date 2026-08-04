import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, sessionCookieOptions } from "@/lib/admin/auth";

/**
 * Ends the session by expiring the cookie. POST rather than GET so that an image
 * or a link on some other site cannot sign the team out for a joke, and the
 * status bar posts a plain form, which works whatever the page's JavaScript is
 * doing.
 *
 * 303 turns the browser's follow-up into a GET; the default 307 would repost to
 * the catalog page, which does not answer POST.
 */
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
