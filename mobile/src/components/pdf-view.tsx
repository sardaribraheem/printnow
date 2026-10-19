import React from "react";
import { Text } from "react-native";
export default function PrivatePdf(_props: {
  uri: string;
  token: string;
  onError(): void;
}) {
  void _props;
  return <Text>Open the Android app for the native document viewer.</Text>;
}
