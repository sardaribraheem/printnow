import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import { configured, supabase, request, upload, finishAuthUrl } from "./client";
import { DemoService } from "./demo";
import { clearSelectedCopies } from "./files";
import type { Session } from "./types";
import type { SelectedFile } from "../navigation";
type Service = {
  read<T>(path: string): Promise<T>;
  mutate<T = { id: string }>(
    action: string,
    input: Record<string, unknown>,
  ): Promise<T>;
  upload(
    requestId: string,
    file: SelectedFile,
    registeredId?: string,
    uploadKey?: string,
  ): Promise<string>;
};
type AppContext = {
  service: Service;
  session: Session | null;
  demo: boolean;
  demoService: DemoService;
  providerMode: boolean;
  setProviderMode(value: boolean): void;
  reload(): Promise<void>;
  enterDemo(): void;
  signOut(): Promise<void>;
  useLiveAccount(): void;
  sessionError: string;
  recovering: boolean;
  setRecovering(value: boolean): void;
};
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(!configured);
  const [demoService, setDemoService] = useState(() => new DemoService());
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [providerMode, setMode] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    clearSelectedCopies();
  }, []);
  const service = useMemo<Service>(
    () =>
      demo
        ? demoService
        : {
            read: <T,>(path: string) => request<T>("marketplace/" + path),
            mutate: <T,>(action: string, input: Record<string, unknown>) =>
              request<T>("marketplace/" + action, input),
            upload,
          },
    [demo, demoService],
  );
  const activeService = useRef(service);
  activeService.current = service;
  const reload = useCallback(async () => {
    if (activeService.current !== service) return;
    if (!demo && !(await supabase?.auth.getSession())?.data.session) {
      setSession(null);
      return;
    }
    try {
      const session = await service.read<Session>("session");
      if (activeService.current === service) {
        setSession(session);
        setSessionError("");
      }
    } catch (error) {
      if (activeService.current === service) {
        setSession(null);
        setSessionError((error as Error).message);
      }
    }
  }, [demo, service]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setSession(null);
        setMode(false);
      }
      // Auth callbacks must not await a second auth operation while the session lock is held.
      setTimeout(() => {
        void reload();
      }, 0);
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [reload]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase?.auth.startAutoRefresh();
        void reload();
      } else supabase?.auth.stopAutoRefresh();
    });
    return () => listener.remove();
  }, [reload]);
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || !supabase) return;
      try {
        const result = await finishAuthUrl(url);
        if (result) {
          setSession(null);
          setDemo(false);
          if (result.recovery) setRecovering(true);
        }
      } catch {
        setSessionError(
          "The sign-in link is invalid or expired. Please try again.",
        );
      }
    };
    void Linking.getInitialURL().then(handle);
    const listener = Linking.addEventListener("url", ({ url }) => {
      void handle(url);
    });
    return () => listener.remove();
  }, []);
  return (
    <Context.Provider
      value={{
        service,
        session,
        demo,
        demoService,
        providerMode,
        setProviderMode(value) {
          setMode(value);
          demoService.providerMode = value;
        },
        reload,
        sessionError,
        recovering,
        setRecovering,
        useLiveAccount() {
          setSession(null);
          setDemo(false);
          setMode(false);
        },
        enterDemo() {
          clearSelectedCopies();
          setDemoService(new DemoService());
          setMode(false);
          setDemo(true);
        },
        async signOut() {
          if (!demo && supabase) {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error)
              throw new Error(
                "Sign-out could not be completed. Check your connection and try again.",
              );
          }
          clearSelectedCopies();
          setSession(null);
          setMode(false);
          setRecovering(false);
          setDemoService(new DemoService());
          setDemo(!configured);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing AppProvider");
  return context;
}
