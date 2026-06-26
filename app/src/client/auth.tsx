import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { api } from "./api";
import type { Me } from "../shared/types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  register: (username: string) => Promise<void>;
  login: () => Promise<void>;
  addPasskey: (name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const register = useCallback(
    async (username: string) => {
      const options = await api.registerOptions(username);
      const att: RegistrationResponseJSON = await startRegistration({ optionsJSON: options as any });
      await api.registerVerify(att, deviceLabel());
      await refresh();
    },
    [refresh],
  );

  const addPasskey = useCallback(
    async (name?: string) => {
      const options = await api.registerOptions();
      const att: RegistrationResponseJSON = await startRegistration({ optionsJSON: options as any });
      await api.registerVerify(att, name ?? deviceLabel());
      await refresh();
    },
    [refresh],
  );

  const login = useCallback(async () => {
    const options = await api.loginOptions();
    const assertion: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options as any });
    await api.loginVerify(assertion);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, register, login, addPasskey, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  return "Passkey";
}
