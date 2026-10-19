import type { SelectedFile } from "../navigation";
export async function inspectSelectedFile(file: SelectedFile) {
  // Browser UI tests cannot exercise Android's on-device PDF renderer.
  return file.mimeType.startsWith("image/") ? { pages: 1 } : {};
}
