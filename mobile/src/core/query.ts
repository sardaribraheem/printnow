import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useApp } from "./provider";
import { supabase } from "./client";
export function useQuery<T>(path: string | null) {
  const { service, demo, providerMode, session } = useApp();
  const identity = session?.user.user_id;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const focused = useIsFocused();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!path || !identity) {
      setData(null);
      return;
    }
    const current = ++generation.current;
    setLoading(true);
    try {
      const value = await service.read<T>(path);
      if (generation.current === current) {
        setData(value);
        setError("");
      }
    } catch (error) {
      if (generation.current === current) setError((error as Error).message);
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [path, service, identity]);
  useEffect(() => {
    setData(null);
    setError("");
    if (!focused || !path) return;
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 12000);
    const listener = AppState.addEventListener("change", (value) => {
      if (value === "active") void refresh();
    });
    const activeGeneration = generation;
    return () => {
      activeGeneration.current++;
      clearInterval(timer);
      listener.remove();
    };
  }, [focused, path, refresh, providerMode]);
  useEffect(() => {
    if (demo || !supabase || !path || !focused) return;
    const [kind, id] = path.split("/");
    const targets =
      kind === "order"
        ? [
            { table: "orders", filter: "id=eq." + id },
            { table: "messages", filter: "order_id=eq." + id },
          ]
        : kind === "request"
          ? [
              { table: "offers", filter: "request_id=eq." + id },
              { table: "print_requests", filter: "id=eq." + id },
            ]
          : kind === "notifications"
            ? [{ table: "notifications" }]
            : [];
    const channel = supabase.channel("native-" + Math.random());
    for (const target of targets)
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", ...target },
        () => {
          void refresh();
        },
      );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void refresh();
    });
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [demo, path, focused, refresh]);
  return { data, error, loading, refresh };
}
