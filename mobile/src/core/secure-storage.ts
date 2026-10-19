import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
const memory = new Map<string, string>();
const safe = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, "_");
type Manifest = { version: string; count: number };
async function manifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const item = JSON.parse(raw);
    return typeof item.version === "string" &&
      /^[a-f0-9-]+$/.test(item.version) &&
      Number.isInteger(item.count) &&
      item.count > 0 &&
      item.count <= 40
      ? item
      : null;
  } catch {
    return null;
  }
}
async function clearParts(key: string, entry: Manifest | null) {
  if (entry)
    await Promise.all(
      Array.from({ length: entry.count }, (_, i) =>
        SecureStore.deleteItemAsync(key + "." + entry.version + "." + i),
      ),
    );
}
export const secureStorage = {
  async getItem(rawKey: string) {
    if (Platform.OS === "web") return memory.get(rawKey) ?? null;
    const key = safe(rawKey),
      entry = await manifest(key);
    if (!entry) return null;
    const parts = await Promise.all(
      Array.from({ length: entry.count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + entry.version + "." + i),
      ),
    );
    return parts.some((part) => part === null) ? null : parts.join("");
  },
  async setItem(rawKey: string, value: string) {
    if (Platform.OS === "web") {
      memory.set(rawKey, value);
      return;
    }
    const key = safe(rawKey),
      old = await manifest(key);
    const entry = {
      version: Crypto.randomUUID(),
      count: Math.ceil(value.length / 1500),
    };
    if (entry.count > 40)
      throw new Error("Session is too large to store securely.");
    try {
      for (let i = 0; i < entry.count; i++)
        await SecureStore.setItemAsync(
          key + "." + entry.version + "." + i,
          value.slice(i * 1500, (i + 1) * 1500),
          { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
        );
      await SecureStore.setItemAsync(key, JSON.stringify(entry), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      await clearParts(key, entry);
      throw error;
    }
    await clearParts(key, old);
  },
  async removeItem(rawKey: string) {
    if (Platform.OS === "web") {
      memory.delete(rawKey);
      return;
    }
    const key = safe(rawKey),
      old = await manifest(key);
    await SecureStore.deleteItemAsync(key);
    await clearParts(key, old);
  },
};
