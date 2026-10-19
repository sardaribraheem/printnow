import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { AppAlert as Alert } from "../components/alert";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ownSelectedCopy, removeSelectedCopy } from "../core/files";
import { inspectSelectedFile } from "../core/inspect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppNavigation } from "../navigation";
import type { SelectedFile } from "../navigation";
import { useApp } from "../core/provider";
import { useQuery } from "../core/query";
import type { History, RequestSummary } from "../core/types";
import { label, validateUploadBatch, formatMoney } from "../core/types";
import { styles as s, colors } from "../theme";
import {
  Screen,
  Icon,
  Button,
  PreviewNotice,
  Empty,
  Badge,
  ErrorNotice,
} from "../components/ui";
export async function pickFiles(): Promise<SelectedFile[] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/png", "image/jpeg"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const files = result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? new File(asset.uri).size,
    mimeType:
      asset.mimeType ??
      (asset.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : asset.name.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg"),
  }));
  const error = validateUploadBatch(files);
  if (error) throw new Error(error);
  const selected: SelectedFile[] = [];
  try {
    for (const file of files) {
      const copy = { ...file, uri: ownSelectedCopy(file.uri, file.name) };
      selected.push(copy);
      Object.assign(copy, await inspectSelectedFile(copy));
    }
    return selected;
  } catch (error) {
    for (const file of selected) removeSelectedCopy(file.uri);
    throw error;
  }
}
export function HomeScreen() {
  const navigation = useAppNavigation();
  const { session, providerMode } = useApp();
  const insets = useSafeAreaInsets();
  const history = useQuery<History>(session ? "history" : null);
  const [picking, setPicking] = useState(false);
  const activeOrder = history.data?.orders.find(
    (order) => !["completed", "cancelled"].includes(order.status),
  );
  const pending = history.data?.requests.find((r) =>
    ["draft", "open"].includes(r.state),
  );
  async function start() {
    if (providerMode) {
      navigation.navigate("Compose");
      return;
    }
    setPicking(true);
    try {
      const files = await pickFiles();
      if (files?.length) navigation.navigate("Compose", { files });
    } catch (error) {
      Alert.alert("Choose your files", (error as Error).message);
    } finally {
      setPicking(false);
    }
  }
  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <Screen refresh={history.refresh} loading={history.loading}>
        <View style={s.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit delivery or pickup details"
            onPress={() => navigation.navigate(session ? "Profile" : "Auth")}
            style={s.row}
          >
            <View
              style={[
                s.circle,
                { backgroundColor: colors.mint, borderWidth: 0 },
              ]}
            >
              <Icon name="location-outline" color={colors.green} />
            </View>
            <View>
              <Text style={s.eyebrow}>
                {session?.user.preferred_fulfillment === "delivery"
                  ? "DELIVER TO"
                  : "YOUR PRINTING AREA"}
              </Text>
              <View style={[s.row, { gap: 5, marginTop: 4 }]}>
                <Text style={s.h3}>
                  {session?.zones[0]?.name ?? "Choose your area"}
                </Text>
                <Icon name="chevron-down" size={14} />
              </View>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={s.circle}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Icon name="notifications-outline" />
          </Pressable>
        </View>
        <PreviewNotice />
        <View style={{ marginTop: 9, gap: 8 }}>
          <Text style={s.muted}>
            Good to see you
            {session?.user.display_name
              ? ", " + session.user.display_name.split(" ")[0]
              : ""}
            .
          </Text>
          <Text style={[s.title, { fontSize: 35, lineHeight: 40 }]}>
            What are we{"\n"}printing today?
          </Text>
        </View>
        <LinearGradient
          colors={["#FFF0DF", "#FFE5D4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 27, padding: 24, gap: 19, overflow: "hidden" }}
        >
          <View style={s.between}>
            <View style={{ flex: 1, gap: 9 }}>
              <View style={[s.badge, { backgroundColor: "#FFFFFFB8" }]}>
                <Text style={[s.badgeText, { color: "#93492D" }]}>
                  A LITTLE LESS HASSLE
                </Text>
              </View>
              <Text style={[s.h2, { fontSize: 25, lineHeight: 30 }]}>
                Your files.{"\n"}Freshly printed.
              </Text>
            </View>
            <View
              style={{
                width: 85,
                height: 104,
                backgroundColor: colors.white,
                borderRadius: 13,
                transform: [{ rotate: "8deg" }],
                padding: 14,
                justifyContent: "space-between",
                shadowColor: "#BA6B40",
                shadowOffset: { width: 0, height: 9 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Icon
                name="document-text-outline"
                size={31}
                color={colors.orange}
              />
              <View style={{ gap: 5 }}>
                <View
                  style={{
                    height: 4,
                    backgroundColor: "#E8EDE6",
                    borderRadius: 2,
                  }}
                />
                <View
                  style={{
                    height: 4,
                    width: "70%",
                    backgroundColor: "#E8EDE6",
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
          </View>
          <Button
            title="Upload & Print"
            icon="cloud-upload-outline"
            busy={picking}
            onPress={() => {
              void start();
            }}
          />
          <Text style={{ fontSize: 12, color: "#825E4C", textAlign: "center" }}>
            PDF, PNG & JPEG · Up to 3 files
          </Text>
        </LinearGradient>
        <View style={[s.row, { justifyContent: "center", gap: 7 }]}>
          <Icon
            name="shield-checkmark-outline"
            size={15}
            color={colors.green}
          />
          <Text style={s.muted}>Private files. Your choice of printer.</Text>
        </View>
        {providerMode && (
          <Button
            title="Open printer job feed"
            outline
            icon="print-outline"
            onPress={() => navigation.navigate("Main")}
          />
        )}
        <View style={s.between}>
          <Text style={s.h2}>Your activity</Text>
          <Text style={s.eyebrow}>ALL IN ONE PLACE</Text>
        </View>
        <ErrorNotice message={history.error} />
        {activeOrder ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Order", { id: activeOrder.id })}
            style={s.card}
          >
            <View style={s.between}>
              <Badge text={label(activeOrder.status)} />
              <Icon name="arrow-forward" size={19} />
            </View>
            <Text style={s.h3}>{activeOrder.title}</Text>
            <Text style={s.muted}>
              {label(activeOrder.mode)} ·{" "}
              {formatMoney(activeOrder.price_snapshot.total_paisa)}
            </Text>
          </Pressable>
        ) : pending ? (
          <RequestCard request={pending} />
        ) : (
          <Empty
            title="Your next print starts here"
            text="Upload a file and compare offers from local printers. Your requests will appear here."
            icon="print-outline"
          />
        )}
        <View
          style={[s.card, { backgroundColor: colors.mint, borderWidth: 0 }]}
        >
          <View style={s.row}>
            <Icon name="sparkles-outline" color={colors.green} />
            <View style={s.grow}>
              <Text style={s.h3}>Clear prices. No platform fee.</Text>
              <Text style={[s.muted, { marginTop: 4 }]}>
                Compare the total, timing and pickup location. Choose what works
                for you.
              </Text>
            </View>
          </View>
        </View>
      </Screen>
    </View>
  );
}
export function RequestCard({ request }: { request: RequestSummary }) {
  const navigation = useAppNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Open " + request.title}
      onPress={() => navigation.navigate("Request", { id: request.id })}
      style={s.card}
    >
      <View style={s.between}>
        <Badge text={label(request.state)} orange={request.state === "open"} />
        <Icon name="arrow-forward" size={18} />
      </View>
      <Text style={s.h3}>{request.title}</Text>
      <Text style={s.muted}>
        {label(request.mode)} ·{" "}
        {request.total_sides
          ? request.total_sides + " printed sides"
          : "Print request"}
      </Text>
    </Pressable>
  );
}
export function HistoryScreen() {
  const { session } = useApp();
  const query = useQuery<History>(session ? "history" : null);
  const navigation = useAppNavigation();
  const [tab, setTab] = useState<"orders" | "requests">("orders");
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <Text style={s.title}>Your prints</Text>
      <View style={s.row}>
        {(["orders", "requests"] as const).map((key) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            key={key}
            onPress={() => setTab(key)}
            style={[
              s.badge,
              {
                padding: 13,
                backgroundColor: tab === key ? colors.ink : colors.white,
              },
            ]}
          >
            <Text
              style={{
                fontWeight: "600",
                color: tab === key ? colors.white : colors.ink,
              }}
            >
              {label(key)}
            </Text>
          </Pressable>
        ))}
      </View>
      <ErrorNotice message={query.error} />
      {tab === "requests" ? (
        query.data?.requests.length ? (
          query.data.requests.map((r) => <RequestCard key={r.id} request={r} />)
        ) : (
          <Empty
            title="No requests yet"
            text="Choose Upload & Print on Home to start your first request."
          />
        )
      ) : query.data?.orders.length ? (
        query.data.orders.map((o) => (
          <Pressable
            accessibilityRole="button"
            key={o.id}
            style={s.card}
            onPress={() => navigation.navigate("Order", { id: o.id })}
          >
            <View style={s.between}>
              <Badge text={label(o.status)} />
              <Text style={s.h3}>
                {formatMoney(o.price_snapshot.total_paisa)}
              </Text>
            </View>
            <Text style={s.h3}>{o.title}</Text>
            <Text style={s.muted}>
              {label(o.mode)} · View progress and chat
            </Text>
          </Pressable>
        ))
      ) : (
        <Empty
          title="Nothing in the queue yet"
          text="Accepted offers become orders. Track them here from printing to handover."
          icon="receipt-outline"
        />
      )}
      {!session && (
        <Button
          title="Sign in to see your orders"
          onPress={() => navigation.navigate("Auth")}
        />
      )}
    </Screen>
  );
}
export function MessagesScreen() {
  const { session } = useApp(),
    navigation = useAppNavigation();
  const query = useQuery<History>(session ? "history" : null);
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <Text style={s.title}>Messages</Text>
      <Text style={s.muted}>
        Keep everything about your order in one conversation.
      </Text>
      <ErrorNotice message={query.error} />
      {query.data?.orders.length ? (
        query.data.orders.map((order) => (
          <Pressable
            accessibilityRole="button"
            key={order.id}
            style={s.card}
            onPress={() =>
              navigation.navigate("Order", { id: order.id, chat: true })
            }
          >
            <View style={s.row}>
              <View style={[s.circle, { backgroundColor: colors.mint }]}>
                <Icon name="chatbubble-ellipses-outline" color={colors.green} />
              </View>
              <View style={s.grow}>
                <Text style={s.h3}>{order.title}</Text>
                <Text style={s.muted}>
                  {label(order.status)} · Open conversation
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} />
            </View>
          </Pressable>
        ))
      ) : (
        <Empty
          icon="chatbubbles-outline"
          title="A conversation starts with an order"
          text="Once an offer is accepted, you and your printer can chat here."
        />
      )}
    </Screen>
  );
}
