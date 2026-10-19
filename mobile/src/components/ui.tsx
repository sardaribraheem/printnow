import React, { useState, useEffect, type ComponentProps } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles as s } from "../theme";
import { useApp } from "../core/provider";
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Screen({
  children,
  refresh,
  loading = false,
}: {
  children: React.ReactNode;
  refresh?: () => void;
  loading?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.orange}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function PreviewNotice() {
  const { demo } = useApp();
  return demo ? (
    <View
      style={{ backgroundColor: colors.peach, padding: 11, borderRadius: 12 }}
    >
      <Text
        style={{
          fontSize: 11,
          color: "#8A4327",
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        PREVIEW MODE · Sample offers and orders · No printing is placed
      </Text>
    </View>
  ) : null;
}
export function Button({
  title,
  onPress,
  busy,
  outline = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress(): void;
  busy?: boolean;
  outline?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        outline && s.outline,
        { opacity: disabled || busy ? 0.5 : pressed ? 0.78 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? colors.ink : colors.white} />
      ) : icon ? (
        <Icon
          name={icon}
          color={outline ? colors.ink : colors.white}
          size={19}
        />
      ) : null}
      <Text style={[s.buttonText, outline && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8A928B"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 95, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choices<const T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange(value: NoInfer<T>): void;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {choices.map((choice) => (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === choice.value }}
            onPress={() => onChange(choice.value)}
            style={{
              minHeight: 46,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: value === choice.value ? colors.ink : colors.line,
              backgroundColor:
                value === choice.value ? colors.ink : colors.white,
            }}
          >
            <Text
              style={{
                color: value === choice.value ? colors.white : colors.ink,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {choice.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <View accessibilityRole="alert" style={s.error}>
      <Text style={s.errorText}>{message}</Text>
    </View>
  ) : null;
}
export function Empty({
  icon = "document-text-outline",
  title,
  text,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: string;
}) {
  return (
    <View style={[s.card, { alignItems: "center", paddingVertical: 34 }]}>
      <View
        style={[s.circle, { backgroundColor: colors.mint, borderWidth: 0 }]}
      >
        <Icon name={icon} color={colors.green} />
      </View>
      <Text style={s.h3}>{title}</Text>
      <Text style={[s.muted, { textAlign: "center" }]}>{text}</Text>
    </View>
  );
}
export function Badge({
  text,
  orange = false,
}: {
  text: string;
  orange?: boolean;
}) {
  return (
    <View style={[s.badge, orange && { backgroundColor: colors.peach }]}>
      <Text style={[s.badgeText, orange && { color: "#9A4527" }]}>{text}</Text>
    </View>
  );
}
export function Countdown({
  expires,
  serverNow,
}: {
  expires: string;
  serverNow: string;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const remaining = Date.parse(expires) - Date.parse(serverNow),
      started = Date.now();
    const update = () =>
      setSeconds(
        Math.max(0, Math.floor((remaining - (Date.now() - started)) / 1000)),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expires, serverNow]);
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: seconds ? colors.green : colors.red,
      }}
    >
      {seconds
        ? Math.floor(seconds / 60) +
          ":" +
          String(seconds % 60).padStart(2, "0") +
          " left"
        : "Expired"}
    </Text>
  );
}
