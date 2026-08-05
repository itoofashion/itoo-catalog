/**
 * What a short link is made of.
 *
 * Six characters, drawn at random, meaning nothing on their own: the database
 * holds the meaning (see store.ts). Six is the length the client asked for, and
 * it is also the shortest length that is not worth guessing at. With this
 * alphabet six characters are 30^6, about 729 million codes, so a stranger
 * hammering the site lands on a real link roughly once in seven hundred million
 * tries per link that exists. There is nothing behind a link but a filtered
 * catalog, and this is a wholesale site, not a secret one.
 */

/**
 * No 0/O, no 1/I/L, no U (which is heard as "you" and read as V in some hands).
 * The point is a code that survives being read out over the phone to a buyer,
 * so the pairs that get confused when spoken or typed are simply not in it.
 * One case only, for the same reason: "capital B, small b" is not a link.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const CODE_LENGTH = 6;

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]+$`);

export function isShortCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * Rejection sampling rather than `byte % 30`: 256 is not a multiple of 30, so
 * the plain remainder would make the first sixteen letters of the alphabet turn
 * up more often than the rest. Bytes that would land in the short tail are
 * thrown away instead, which costs a few extra bytes and buys a flat spread.
 */
const CEILING = 256 - (256 % CODE_ALPHABET.length);

export function randomCode(length: number = CODE_LENGTH): string {
  let code = "";
  while (code.length < length) {
    const bytes = new Uint8Array(length - code.length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= CEILING) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}
