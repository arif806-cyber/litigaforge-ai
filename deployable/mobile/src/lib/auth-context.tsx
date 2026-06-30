import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";

const TOKEN_KEY = "lf_token";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  subscription_tier: string;
  is_superuser?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

async function saveToken(t: string | null) {
  try {
    if (t) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // SecureStore may not be available in all environments (e.g. web)
  }
}

async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = useCallback((t: string | null) => {
    if (t) {
      api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
    setToken(t);
  }, []);

  const fetchMe = useCallback(
    async (t: string) => {
      try {
        const res = await api.get<AuthUser>("/auth/me", {
          headers: { Authorization: `Bearer ${t}` },
        });
        setUser(res.data);
        applyToken(t);
      } catch {
        await saveToken(null);
        applyToken(null);
        setUser(null);
      }
    },
    [applyToken]
  );

  useEffect(() => {
    loadToken()
      .then((saved) => {
        if (saved) return fetchMe(saved);
      })
      .finally(() => setIsLoading(false));
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: AuthUser; token: string }>("/auth/login", {
      email,
      password,
    });
    const t = res.data.token;
    await saveToken(t);
    applyToken(t);
    setUser(res.data.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role = "client"
  ) => {
    const res = await api.post<{ user: AuthUser; token: string }>("/auth/register", {
      name,
      email,
      password,
      role,
    });
    const t = res.data.token;
    await saveToken(t);
    applyToken(t);
    setUser(res.data.user);
  };

  const logout = async () => {
    await saveToken(null);
    applyToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
