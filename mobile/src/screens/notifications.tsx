import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../core/provider";
import { useQuery } from "../core/query";
import { type NotificationItem, label } from "../core/types";
import { useAppNavigation } from "../navigation";
import { styles as s } from "../theme";
import {
  Screen,
  PreviewNotice,
  Empty,
  ErrorNotice,
  Icon,
} from "../components/ui";
export function NotificationsScreen() {
  const { session, service } = useApp(),
    navigation = useAppNavigation();
  const query = useQuery<NotificationItem[]>(session ? "notifications" : null);
  const [error, setError] = useState("");
  async function open(item: NotificationItem) {
    try {
      await service.mutate("notification_read", { id: item.id });
      if (
        ["new_offer", "new_request", "clarification_requested"].includes(
          item.kind,
        )
      )
        navigation.navigate("Request", { id: item.entity_id });
      else navigation.navigate("Order", { id: item.entity_id });
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <Text style={s.title}>Your updates</Text>
      <Text style={s.muted}>Offers, conversations and order progress.</Text>
      <ErrorNotice message={error || query.error} />
      {query.data?.length ? (
        query.data.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            style={s.card}
            onPress={() => {
              void open(item);
            }}
          >
            <View style={s.row}>
              <Icon
                name={item.read_at ? "notifications-outline" : "notifications"}
              />
              <View style={s.grow}>
                <Text style={s.h3}>{label(item.kind)}</Text>
                <Text style={s.muted}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
              <Icon name="chevron-forward" size={17} />
            </View>
          </Pressable>
        ))
      ) : (
        <Empty
          title="All quiet for now"
          text="Your printing updates will appear here."
          icon="notifications-outline"
        />
      )}
      <View style={s.card}>
        <Text style={s.h3}>About push alerts</Text>
        <Text style={s.muted}>
          Background push alerts are coming in the connected beta. This build
          refreshes updates while the app is open and when you return.
        </Text>
      </View>
    </Screen>
  );
}
