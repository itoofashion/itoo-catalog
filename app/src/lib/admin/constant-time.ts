/**
 * Compares without leaking, through timing, how much of the value matched.
 *
 * Both a session signature and a derived password hash are guessed one byte at
 * a time by anyone who can measure how long the comparison ran, so neither is
 * ever compared with `===`.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
