// Browser-only credentials. Never put credentials in localStorage or a URL.
let token: string | null = null;
let onFailure: ((code: string) => void) | null = null;
export const getToken = () => token;
export function setAuthTransport(value: string | null, handler: ((code: string) => void) | null) {
  token = value; onFailure = handler;
}
export function authenticationFailed(requestToken: string, code: string) {
  // A delayed response from the previous session must not clear a new session.
  if (requestToken === token) onFailure?.(code);
}
