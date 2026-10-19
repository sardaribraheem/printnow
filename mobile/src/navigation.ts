import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
export type SelectedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  pages?: number;
  width?: number;
  height?: number;
};
export type RootStack = {
  Main: undefined;
  Compose: { files?: SelectedFile[] } | undefined;
  Request: { id: string };
  Order: { id: string; chat?: boolean };
  Auth: undefined;
  Profile: undefined;
  ProviderSetup: undefined;
  ProviderSettings: undefined;
  Notifications: undefined;
  FilePreview: { id: string; name: string };
  LocalPreview: { file: SelectedFile };
};
export function useAppNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStack>>();
}
