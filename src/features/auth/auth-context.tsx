"use client";

import { createContext, useContext, useEffect, useState } from "react";

type AuthUser = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
};

type OnPointUserData = {
  theme: "dark-gold";
  createdAtIso: string;
  preferences: {
    timezone: string;
  };
};

type AuthContextValue = {
  user: AuthUser | null;
  appUserData: OnPointUserData | null;
  isReady: boolean;
  isGoogleReady: boolean;
  isCalendarScopeGranted: boolean;
  googleAccessToken: string | null;
  signInWithGoogle: () => Promise<void>;
  refreshGoogleAccessToken: () => Promise<void>;
  updateAppUserData: (patch: Partial<OnPointUserData>) => void;
  signOut: () => void;
};

const SESSION_KEY = "onpoint_auth_session";
const ACCESS_TOKEN_KEY = "onpoint_google_access_token";
const GOOGLE_SCRIPT_ID = "google-identity-services-oauth";

function appDataKey(uid: string) {
  return `onpoint_app_user_data_${uid}`;
}

type GoogleOauthWindow = Window & {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (options: {
          client_id: string;
          scope: string;
          callback: (response: { access_token?: string; error?: string }) => void;
        }) => {
          requestAccessToken: (options?: { prompt?: string }) => void;
        };
      };
    };
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

function defaultAppUserData(): OnPointUserData {
  return {
    theme: "dark-gold",
    createdAtIso: new Date().toISOString(),
    preferences: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

function readInitialAuthState() {
  if (typeof window === "undefined") {
    return {
      user: null as AuthUser | null,
      appUserData: null as OnPointUserData | null,
      token: null as string | null,
      isCalendarScopeGranted: false,
    };
  }

  let user: AuthUser | null = null;
  let appUserData: OnPointUserData | null = null;

  const storedUserRaw = localStorage.getItem(SESSION_KEY);
  if (storedUserRaw) {
    try {
      const parsed = JSON.parse(storedUserRaw) as AuthUser;
      user = parsed;

      const rawStored = localStorage.getItem(appDataKey(parsed.uid));
      if (rawStored) {
        appUserData = JSON.parse(rawStored) as OnPointUserData;
      } else {
        const created = defaultAppUserData();
        localStorage.setItem(appDataKey(parsed.uid), JSON.stringify(created));
        appUserData = created;
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);

  return {
    user,
    appUserData,
    token,
    isCalendarScopeGranted: Boolean(token),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [initial] = useState(readInitialAuthState);

  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [appUserData, setAppUserData] = useState<OnPointUserData | null>(initial.appUserData);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(initial.token);
  const [isReady, setIsReady] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const googleWindow = window as GoogleOauthWindow;
    return Boolean(document.getElementById(GOOGLE_SCRIPT_ID) || googleWindow.google?.accounts.oauth2);
  });
  const [isGoogleReady, setIsGoogleReady] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const googleWindow = window as GoogleOauthWindow;
    return Boolean(googleWindow.google?.accounts.oauth2);
  });
  const [isCalendarScopeGranted, setIsCalendarScopeGranted] = useState(initial.isCalendarScopeGranted);

  useEffect(() => {
    const googleWindow = window as GoogleOauthWindow;
    if (googleWindow.google?.accounts.oauth2) {
      return;
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsGoogleReady(true);
      setIsReady(true);
    };
    script.onerror = () => setIsReady(true);
    document.head.appendChild(script);
  }, []);

  async function fetchUserProfile(token: string): Promise<AuthUser> {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Could not fetch Google profile.");
    }

    const data = (await response.json()) as {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
    };

    if (!data.email || !data.sub) {
      throw new Error("Google profile did not return required identity fields.");
    }

    return {
      uid: data.sub,
      email: data.email.toLowerCase(),
      displayName: data.name ?? null,
      photoURL: data.picture ?? null,
    };
  }

  async function requestToken(prompt: "consent" | "" = "consent") {
    if (!googleClientId) {
      throw new Error("Google auth is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
    }

    const googleWindow = window as GoogleOauthWindow;
    const oauth = googleWindow.google?.accounts.oauth2;

    if (!oauth) {
      throw new Error("Google Identity Services is not ready yet.");
    }

    return new Promise<string>((resolve, reject) => {
      const tokenClient = oauth.initTokenClient({
        client_id: googleClientId,
        scope: "openid email profile https://www.googleapis.com/auth/calendar",
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error ?? "Google sign-in failed."));
            return;
          }
          resolve(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt });
    });
  }

  async function signInWithGoogle() {
    const token = await requestToken("consent");
    const profile = await fetchUserProfile(token);

    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    const rawStored = localStorage.getItem(appDataKey(profile.uid));
    if (rawStored) {
      setAppUserData(JSON.parse(rawStored) as OnPointUserData);
    } else {
      const created = defaultAppUserData();
      localStorage.setItem(appDataKey(profile.uid), JSON.stringify(created));
      setAppUserData(created);
    }

    setUser(profile);
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    setGoogleAccessToken(token);
    setIsCalendarScopeGranted(true);
  }

  async function refreshGoogleAccessToken() {
    const token = await requestToken("");

    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    setGoogleAccessToken(token);
    setIsCalendarScopeGranted(true);
  }

  function updateAppUserData(patch: Partial<OnPointUserData>) {
    if (!user) {
      return;
    }

    setAppUserData((prev) => {
      const next: OnPointUserData = {
        ...(prev ?? defaultAppUserData()),
        ...patch,
        preferences: {
          ...(prev?.preferences ?? defaultAppUserData().preferences),
          ...(patch.preferences ?? {}),
        },
      };

      localStorage.setItem(appDataKey(user.uid), JSON.stringify(next));
      return next;
    });
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    setUser(null);
    setAppUserData(null);
    setGoogleAccessToken(null);
    setIsCalendarScopeGranted(false);
  }

  const value: AuthContextValue = {
    user,
    appUserData,
    isReady,
    isGoogleReady,
    isCalendarScopeGranted,
    googleAccessToken,
    signInWithGoogle,
    refreshGoogleAccessToken,
    updateAppUserData,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
