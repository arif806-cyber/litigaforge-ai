export const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
export const hasAppleClientId = !!APPLE_CLIENT_ID;

declare global {
  interface Window {
    AppleID: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state?: string;
          nonce?: string;
          usePopup?: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            code: string;
            id_token: string;
            state?: string;
          };
          user?: {
            name?: { firstName?: string; lastName?: string };
            email?: string;
          };
        }>;
      };
    };
  }
}

let appleSDKLoaded = false;

export function loadAppleSDK(): Promise<void> {
  if (!APPLE_CLIENT_ID) return Promise.resolve();
  if (appleSDKLoaded || document.getElementById("apple-sdk")) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = "apple-sdk";
    s.src =
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    s.async = true;
    s.onload = () => {
      appleSDKLoaded = true;
      resolve();
    };
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export async function signInWithApple(): Promise<{
  id_token: string;
  user?: { firstName?: string; lastName?: string; email?: string };
}> {
  await loadAppleSDK();
  if (!window.AppleID?.auth) throw new Error("Apple Sign-In SDK not loaded");

  const origin = window.location.origin;
  window.AppleID.auth.init({
    clientId: APPLE_CLIENT_ID as string,
    scope: "name email",
    redirectURI: `${origin}/login`,
    usePopup: true,
  });

  const data = await window.AppleID.auth.signIn();
  return {
    id_token: data.authorization.id_token,
    user: {
      firstName: data.user?.name?.firstName,
      lastName: data.user?.name?.lastName,
      email: data.user?.email,
    },
  };
}
