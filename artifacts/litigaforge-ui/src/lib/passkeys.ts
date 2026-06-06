const BASE = "/litigaforge";

export const hasPasskeySupport =
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential !== "undefined" &&
  typeof navigator.credentials?.create === "function" &&
  typeof navigator.credentials?.get === "function";

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function encodeCredentialForServer(cred: PublicKeyCredential): object {
  const response = cred.response as AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;

  const base: Record<string, unknown> = {
    id: cred.id,
    rawId: bufferToBase64Url(cred.rawId),
    type: cred.type,
  };

  if ("attestationObject" in response) {
    base.response = {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url((response as AuthenticatorAttestationResponse).attestationObject),
    };
  } else {
    const r = response as AuthenticatorAssertionResponse;
    base.response = {
      clientDataJSON: bufferToBase64Url(r.clientDataJSON),
      authenticatorData: bufferToBase64Url(r.authenticatorData),
      signature: bufferToBase64Url(r.signature),
      userHandle: r.userHandle ? bufferToBase64Url(r.userHandle) : null,
    };
  }
  return base;
}

export async function registerPasskey(token: string): Promise<void> {
  const optRes = await fetch(`${BASE}/auth/passkey/register-options`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!optRes.ok) throw new Error("Could not get passkey registration options");
  const options = await optRes.json();

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    rp: options.rp,
    user: {
      id: base64UrlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    authenticatorSelection: options.authenticatorSelection,
    timeout: options.timeout ?? 60000,
    attestation: "none",
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  if (!credential) throw new Error("Passkey creation cancelled");

  const regRes = await fetch(`${BASE}/auth/passkey/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(encodeCredentialForServer(credential)),
  });
  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({}));
    throw new Error(err.detail ?? "Passkey registration failed");
  }
}

export async function authenticatePasskey(): Promise<{
  token: string;
  user: Record<string, unknown>;
}> {
  const optRes = await fetch(`${BASE}/auth/passkey/login-options`, { method: "POST" });
  if (!optRes.ok) throw new Error("Could not get passkey login options");
  const options = await optRes.json();

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    rpId: options.rpId,
    userVerification: options.userVerification ?? "required",
    timeout: options.timeout ?? 60000,
    allowCredentials: [],
  };

  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  if (!credential) throw new Error("Passkey authentication cancelled");

  const response = await fetch(`${BASE}/auth/passkey/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encodeCredentialForServer(credential)),
    credentials: "include",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? "Passkey login failed");
  }
  return response.json();
}
