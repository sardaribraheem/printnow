import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
const directory = () => new Directory(Paths.cache, "printnow-selected");
export function ownSelectedCopy(uri: string, name: string) {
  if (Platform.OS === "web") return uri;
  const cache = directory();
  cache.create({ idempotent: true, intermediates: true });
  const extension =
    name
      .toLowerCase()
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/g, "") || "file";
  const target = new File(cache, Crypto.randomUUID() + "." + extension);
  const original = new File(uri);
  original.copy(target);
  if (original.uri.startsWith(Paths.cache.uri)) original.delete();
  return target.uri;
}
export function clearSelectedCopies() {
  if (Platform.OS === "web") return;
  const cache = directory();
  if (cache.exists) cache.delete();
}
export function removeSelectedCopy(uri: string) {
  if (Platform.OS === "web") return;
  if (!uri.startsWith(directory().uri.replace(/\/$/, "") + "/")) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
