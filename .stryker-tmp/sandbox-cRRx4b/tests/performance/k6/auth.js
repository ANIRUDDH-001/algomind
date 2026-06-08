// @ts-nocheck
import encoding from 'k6/encoding';

const MAX_COOKIE_CHUNK_SIZE = 3180;

function createCookieChunks(key, value) {
  const encodedValue = encodeURIComponent(value);

  if (encodedValue.length <= MAX_COOKIE_CHUNK_SIZE) {
    return [{ name: key, value: encodedValue }];
  }

  const chunks = [];
  let remaining = encodedValue;

  while (remaining.length > 0) {
    let chunkHead = remaining.slice(0, MAX_COOKIE_CHUNK_SIZE);
    const lastEscapePos = chunkHead.lastIndexOf('%');

    if (lastEscapePos > MAX_COOKIE_CHUNK_SIZE - 3) {
      chunkHead = chunkHead.slice(0, lastEscapePos);
    }

    let decoded = '';
    while (chunkHead.length > 0) {
      try {
        decoded = decodeURIComponent(chunkHead);
        break;
      } catch (error) {
        if (error instanceof URIError && chunkHead.endsWith('%') && chunkHead.length > 3) {
          chunkHead = chunkHead.slice(0, chunkHead.length - 3);
        } else {
          throw error;
        }
      }
    }

    chunks.push(decoded);
    remaining = remaining.slice(chunkHead.length);
  }

  return chunks.map((chunk, index) => ({ name: `${key}.${index}`, value: encodeURIComponent(chunk) }));
}

function base64UrlEncode(value) {
  return encoding.b64encode(value, 'rawurl');
}

function resolveSessionFromEnv() {
  const rawCookieHeader = __ENV.LOAD_AUTH_COOKIE_HEADER || __ENV.LOAD_RAW_COOKIE_HEADER || '';
  const cookieName = __ENV.LOAD_AUTH_COOKIE_NAME || '';
  const cookieValue = __ENV.LOAD_AUTH_COOKIE_VALUE || '';
  const accessToken = __ENV.LOAD_AUTH_ACCESS_TOKEN || '';

  if (rawCookieHeader) {
    return {
      rawCookieHeader,
      cookieName: '',
      cookieValue: '',
      accessToken,
    };
  }

  if (!cookieName || !cookieValue) {
    throw new Error('Either LOAD_AUTH_COOKIE_HEADER or LOAD_AUTH_COOKIE_NAME + LOAD_AUTH_COOKIE_VALUE are required');
  }

  return {
    rawCookieHeader: '',
    cookieName,
    cookieValue,
    accessToken,
  };
}

const AUTH_STATE = resolveSessionFromEnv();

export function buildRealUserAuthHeaders(extraHeaders = {}) {
  if (AUTH_STATE.rawCookieHeader) {
    return {
      ...extraHeaders,
      Cookie: AUTH_STATE.rawCookieHeader,
      ...(AUTH_STATE.accessToken ? { Authorization: `Bearer ${AUTH_STATE.accessToken}` } : {}),
    };
  }

  const cookieValue = AUTH_STATE.cookieValue.startsWith('base64-')
    ? AUTH_STATE.cookieValue
    : `base64-${base64UrlEncode(AUTH_STATE.cookieValue)}`;

  const chunks = createCookieChunks(AUTH_STATE.cookieName, cookieValue);
  const cookieHeader = chunks.map(({ name, value }) => `${name}=${value}`).join('; ');

  return {
    ...extraHeaders,
    Cookie: cookieHeader,
    ...(AUTH_STATE.accessToken ? { Authorization: `Bearer ${AUTH_STATE.accessToken}` } : {}),
  };
}
