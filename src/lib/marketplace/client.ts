"use client";
export async function api<T>(path: string, input?: unknown): Promise<T> {
  const r = await fetch("/api/marketplace/" + path, {
    method: input === undefined ? "GET" : "POST",
    headers:
      input === undefined ? undefined : { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.message ?? "Something went wrong."), {
      code: data.error,
    });
  return data;
}

export async function uploadRequestFile(requestId: string, file: File) {
  const start = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: requestId,
      name: file.name,
      bytes: file.size,
    }),
  });
  const metadata = await start.json();
  if (!start.ok) throw new Error(metadata.message ?? "Unable to start upload.");
  const response = await fetch(metadata.upload_url, {
    method: metadata.local ? "POST" : "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed. Please try again.");
  await api("finalize_file", { id: metadata.id });
  return metadata.id as string;
}
export async function listenForChanges(path: string, refresh: () => void) {
  if (typeof document === "undefined" || document.querySelector(".sandbox-bar"))
    return () => {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return () => {};
  const { createBrowserClient } = await import("@supabase/ssr");
  const client = createBrowserClient(url, key);
  const [kind, id] = path.split("/");
  const channel = client.channel("printnow-" + crypto.randomUUID());
  const targets =
    kind === "order"
      ? [
          { table: "messages", filter: `order_id=eq.${id}` },
          { table: "orders", filter: `id=eq.${id}` },
        ]
      : kind === "request"
        ? [
            { table: "offers", filter: `request_id=eq.${id}` },
            { table: "print_requests", filter: `id=eq.${id}` },
          ]
        : kind === "notifications"
          ? [{ table: "notifications" }]
          : [];
  if (!targets.length) return () => {};
  for (const target of targets)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", ...target },
      () => refresh(),
    );
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") refresh();
  });
  return () => {
    void client.removeChannel(channel);
  };
}
