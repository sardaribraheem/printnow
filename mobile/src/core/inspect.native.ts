import { Platform } from "react-native";
import { requireNativeModule } from "expo";
import type { SelectedFile } from "../navigation";
type Inspection = { pages: number; width?: number; height?: number };
const inspector =
  Platform.OS === "android"
    ? requireNativeModule<{
        inspectLocalFile(uri: string, kind: string): Promise<Inspection>;
      }>("PrintNowPdf")
    : null;
export async function inspectSelectedFile(
  file: SelectedFile,
): Promise<Partial<Inspection>> {
  const kind = file.name.toLowerCase().endsWith(".pdf")
    ? "pdf"
    : file.name.toLowerCase().endsWith(".png")
      ? "png"
      : "jpeg";
  if (!inspector) return kind === "pdf" ? {} : { pages: 1 };
  return inspector.inspectLocalFile(file.uri, kind);
}
