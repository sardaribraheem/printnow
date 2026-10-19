import React from "react";
import { Platform, Text } from "react-native";
import { requireNativeView } from "expo";
import { colors } from "../theme";
const NativePdf =
  Platform.OS === "android"
    ? requireNativeView<{
        source: { uri: string; token: string };
        style: object;
      }>("PrintNowPdf")
    : null;
export default function PrivatePdf({
  uri,
  token,
}: {
  uri: string;
  token: string;
  onError(): void;
}) {
  return NativePdf ? (
    <NativePdf
      source={{ uri, token }}
      style={{ flex: 1, backgroundColor: colors.background }}
    />
  ) : (
    <Text>
      The private PDF viewer is available in the Android beta. iPhone support is
      pending.
    </Text>
  );
}
