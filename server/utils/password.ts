const ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const ALGORITHM = 'PBKDF2';
const DIGEST = 'SHA-256';
const PREFIX = 'pbkdf2-sha256';

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits({
    name: ALGORITHM,
    hash: DIGEST,
    salt: salt.buffer as ArrayBuffer,
    iterations,
  }, material, KEY_LENGTH * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, ITERATIONS);
  return `$${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(input: { hash: string, password: string }): Promise<boolean> {
  const [, prefix, iterationsValue, saltValue, expectedValue] = input.hash.split('$');
  const iterations = Number.parseInt(iterationsValue ?? '', 10);
  if (prefix !== PREFIX
    || !Number.isSafeInteger(iterations)
    || iterations < 100_000
    || !saltValue
    || !expectedValue) {
    return false;
  }

  const salt = fromBase64(saltValue);
  const expected = fromBase64(expectedValue);
  const actual = await derivePassword(input.password, salt, iterations);
  if (actual.length !== expected.length)
    return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++)
    difference |= actual[index]! ^ expected[index]!;
  return difference === 0;
}
