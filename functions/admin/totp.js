// functions/admin/totp.js
//
// TOTP (RFC 6238) verification using the Web Crypto API.
// Compatible with Google Authenticator, Authy, 1Password, Bitwarden TOTP,
// Microsoft Authenticator, and every other standard TOTP app.
//
// Standard parameters: SHA-1, 30-second period, 6 digits, ±1 step tolerance
// for clock drift between server and user phone.

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const STEP_TOLERANCE = 1; // accept current code, previous, or next

export async function verifyTotp(secretBase32, providedCode) {
  if (!secretBase32 || !providedCode) return false;
  // Normalize input: strip spaces, ensure 6 digits
  providedCode = String(providedCode).replace(/\s/g, '');
  if (!/^\d{6}$/.test(providedCode)) return false;

  const secretBytes = base32Decode(secretBase32);
  if (!secretBytes) return false;

  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / PERIOD_SECONDS);

  // Constant-time-ish comparison across the tolerance window
  let valid = false;
  for (let offset = -STEP_TOLERANCE; offset <= STEP_TOLERANCE; offset++) {
    const expected = await generateTotpCode(secretBytes, currentStep + offset);
    if (timingSafeEqual(expected, providedCode)) {
      valid = true;
      // Don't early-return - keep iterating to maintain constant-ish time
    }
  }
  return valid;
}

async function generateTotpCode(secretBytes, step) {
  // Encode step as 8-byte big-endian buffer (RFC 4226)
  const stepBuf = new ArrayBuffer(8);
  const view = new DataView(stepBuf);
  // JS doesn't have setBigUint64 in all Workers runtimes - do it manually
  view.setUint32(0, Math.floor(step / 0x100000000));
  view.setUint32(4, step >>> 0);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, stepBuf));

  // Dynamic truncation per RFC 4226 §5.3
  const offset = digest[19] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = binary % Math.pow(10, DIGITS);
  return String(code).padStart(DIGITS, '0');
}

// RFC 4648 base32 decoder. Strips whitespace and padding, accepts lowercase.
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/[\s=]/g, '');
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
