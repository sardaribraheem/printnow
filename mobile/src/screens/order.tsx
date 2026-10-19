import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { AppAlert as Alert } from "../components/alert";
import { useRoute, type RouteProp } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import type { RootStack } from "../navigation";
import { useApp } from "../core/provider";
import { useQuery } from "../core/query";
import { type Order, label, formatMoney } from "../core/types";
import { styles as s, colors } from "../theme";
import {
  Screen,
  PreviewNotice,
  ErrorNotice,
  Button,
  Field,
  Choices,
  Badge,
  Icon,
} from "../components/ui";
export function OrderScreen() {
  const { params } = useRoute<RouteProp<RootStack, "Order">>();
  const { service } = useApp(),
    query = useQuery<Order>("order/" + params.id),
    order = query.data;
  const [tab, setTab] = useState(params.chat ? "chat" : "progress"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [category, setCategory] = useState("wrong_output");
  const pendingMessage = useRef<{ body: string; key: string } | null>(null);
  const orderId = order?.id,
    messageCount = order?.messages.length;
  useEffect(() => {
    if (orderId && tab === "chat")
      void service.mutate("mark_order_read", { id: orderId }).catch(() => {});
  }, [orderId, messageCount, service, tab]);
  async function act(action: string, input: Record<string, unknown>) {
    if (!order) return false;
    setBusy(true);
    setError("");
    try {
      await service.mutate(action, { id: order.id, ...input });
      await query.refresh();
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!order)
    return (
      <Screen>
        <ErrorNotice message={query.error} />
        <Button
          title="Refresh order"
          outline
          onPress={() => {
            void query.refresh();
          }}
        />
      </Screen>
    );
  const next = (
    {
      confirmed: "printing",
      printing: "ready",
      ready: order.mode === "delivery" ? "out_for_delivery" : "collected",
      out_for_delivery: "delivered",
    } as Record<string, string>
  )[order.status];
  const steps =
    order.mode === "delivery"
      ? [
          "confirmed",
          "printing",
          "ready",
          "out_for_delivery",
          "delivered",
          "completed",
        ]
      : ["confirmed", "printing", "ready", "collected", "completed"];
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <View style={s.between}>
        <Badge text={label(order.status)} />
        <Text style={s.eyebrow}>
          ORDER #{order.id.slice(0, 6).toUpperCase()}
        </Text>
      </View>
      <Text style={s.title}>{order.spec_snapshot.title}</Text>
      <Text style={s.muted}>
        {order.provider_name} · {formatMoney(order.price_snapshot.total_paisa)}{" "}
        total
      </Text>
      <ErrorNotice message={error || query.error} />
      <Choices
        label="Your order"
        value={tab}
        choices={[
          { value: "progress", label: "Progress" },
          { value: "chat", label: "Chat" },
          { value: "details", label: "Details" },
          { value: "help", label: "Help" },
        ]}
        onChange={setTab}
      />
      {tab === "progress" ? (
        <>
          <View style={s.card}>
            {steps.map((status, index) => {
              const current = steps.indexOf(order.status),
                done = current >= index;
              return (
                <View
                  key={status}
                  style={[
                    s.row,
                    { marginBottom: index < steps.length - 1 ? 8 : 0 },
                  ]}
                >
                  <View
                    style={[
                      s.circle,
                      {
                        width: 34,
                        height: 34,
                        borderColor: done ? colors.green : colors.line,
                        backgroundColor: done ? colors.mint : colors.white,
                      },
                    ]}
                  >
                    <Icon
                      name={done ? "checkmark" : "ellipse-outline"}
                      color={done ? colors.green : "#B9C2B7"}
                      size={17}
                    />
                  </View>
                  <Text
                    style={[
                      s.text,
                      {
                        color: done ? colors.ink : colors.muted,
                        fontWeight: current === index ? "700" : "400",
                      },
                    ]}
                  >
                    {label(status)}
                  </Text>
                </View>
              );
            })}
            <View style={s.divider} />
            <Text style={s.muted}>
              Agreed {order.mode === "pickup" ? "pickup-ready" : "delivery"}{" "}
              time:{" "}
              {new Date(order.due_at).toLocaleTimeString("en-PK", {
                timeZone: "Asia/Karachi",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              PKT
            </Text>
          </View>
          {!order.mine && next && (
            <Button
              title={"Mark " + label(next).toLowerCase()}
              busy={busy}
              onPress={() =>
                Alert.alert(
                  "Update order?",
                  "Mark this job as " + label(next).toLowerCase() + "?",
                  [
                    { text: "Back", style: "cancel" },
                    {
                      text: "Confirm",
                      onPress: () => {
                        void act("transition", {
                          version: order.row_version,
                          status: next,
                        });
                      },
                    },
                  ],
                )
              }
            />
          )}
          {order.mine &&
            ["ready", "delivered", "collected"].includes(order.status) && (
              <Button
                title="Confirm prints received"
                busy={busy}
                onPress={() =>
                  Alert.alert(
                    "Received the correct prints?",
                    "Confirm only after you have received and checked your prints.",
                    [
                      { text: "Not yet", style: "cancel" },
                      {
                        text: "Confirm received",
                        onPress: () => {
                          void act("transition", {
                            version: order.row_version,
                            status: "completed",
                          });
                        },
                      },
                    ],
                  )
                }
              />
            )}
          <View style={s.card}>
            <Text style={s.h2}>
              {order.mode === "pickup"
                ? "Collection details"
                : "Delivery details"}
            </Text>
            <Text style={s.text}>
              {order.mode === "pickup"
                ? order.contacts.pickup_address
                : order.contacts.delivery?.address}
            </Text>
            <Text style={s.muted}>
              {order.mode === "pickup"
                ? order.contacts.hours
                : order.contacts.delivery?.landmark}
            </Text>
            <Text style={s.text}>
              Contact:{" "}
              {order.mine
                ? order.contacts.provider_phone
                : order.contacts.customer_phone}
            </Text>
          </View>
          <Button
            title="Message about this order"
            icon="chatbubble-ellipses-outline"
            outline
            onPress={() => setTab("chat")}
          />
        </>
      ) : tab === "chat" ? (
        <>
          <View style={[s.card, { backgroundColor: colors.mint }]}>
            <Text style={s.muted}>
              Approved: {order.spec_snapshot.settings.size} ·{" "}
              {order.spec_snapshot.settings.color === "bw" ? "B&W" : "Color"} ·{" "}
              {order.spec_snapshot.settings.copies} copies. Chat does not change
              approved print settings or price.
            </Text>
          </View>
          {!order.messages.length && (
            <Text style={[s.muted, { textAlign: "center", padding: 16 }]}>
              Say hello. Keep your order details here.
            </Text>
          )}
          {order.messages.map((item) => (
            <View
              key={item.id}
              style={{
                maxWidth: "88%",
                alignSelf: item.mine ? "flex-end" : "flex-start",
                backgroundColor: item.mine ? colors.ink : colors.white,
                borderRadius: 17,
                padding: 15,
                gap: 5,
              }}
            >
              <Text
                style={{
                  color: item.mine ? colors.white : colors.ink,
                  fontSize: 15,
                  lineHeight: 22,
                }}
              >
                {item.body}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: item.mine ? "#CBD4CA" : colors.muted,
                }}
              >
                {item.sender_name} ·{" "}
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))}
          <Field
            label="Your message"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            placeholder="Write a message…"
          />
          <Button
            title="Send message"
            icon="send-outline"
            busy={busy}
            disabled={!message.trim()}
            onPress={async () => {
              const body = message.trim();
              if (pendingMessage.current?.body !== body)
                pendingMessage.current = { body, key: Crypto.randomUUID() };
              if (await act("message", pendingMessage.current)) {
                pendingMessage.current = null;
                setMessage("");
              }
            }}
          />
        </>
      ) : tab === "details" ? (
        <>
          <View style={s.card}>
            <Text style={s.h2}>Approved print job</Text>
            <Text style={s.text}>
              {order.spec_snapshot.settings.size} ·{" "}
              {order.spec_snapshot.settings.color === "bw"
                ? "Black & white"
                : "Color"}
              {"\n"}
              {order.spec_snapshot.settings.copies} copies ·{" "}
              {order.spec_snapshot.settings.duplex
                ? "Double-sided"
                : "Single-sided"}
              {"\n"}
              {order.spec_snapshot.sides} printed sides ·{" "}
              {order.spec_snapshot.sheets} sheets
            </Text>
            <Text style={s.muted}>
              {order.spec_snapshot.instructions || "No extra instructions."}
            </Text>
            <View style={s.divider} />
            <Text style={s.text}>
              Printing: {formatMoney(order.price_snapshot.print_paisa)}
              {"\n"}Delivery: {formatMoney(order.price_snapshot.delivery_paisa)}
              {"\n"}Platform fee:{" "}
              {formatMoney(order.price_snapshot.platform_fee_paisa)}
            </Text>
            <Text style={s.h2}>
              Total {formatMoney(order.price_snapshot.total_paisa)}
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.h2}>Payment at handover</Text>
            <Text style={s.text}>
              {label(order.price_snapshot.payment_method)} · Pay the printer
              directly.
            </Text>
            <Text style={s.muted}>
              Customer: {label(order.customer_payment ?? "not_reported")}
              {"\n"}Printer: {label(order.provider_payment ?? "not_reported")}
              {"\n"}These are participant reports, not bank verification.
            </Text>
            <Button
              title={
                order.mine ? "Report that I paid" : "Report payment received"
              }
              outline
              busy={busy}
              onPress={() => {
                void act("payment", {
                  assertion: order.mine ? "paid" : "received",
                });
              }}
            />
            <Button
              title={
                order.mine ? "Report not paid" : "Report payment not received"
              }
              outline
              busy={busy}
              onPress={() => {
                void act("payment", {
                  assertion: order.mine ? "not_paid" : "not_received",
                });
              }}
            />
          </View>
          <View style={s.card}>
            <Text style={s.h2}>Order activity</Text>
            {order.events.map((event) => (
              <View key={event.id}>
                <Text style={s.text}>{label(event.kind)}</Text>
                <Text style={s.muted}>
                  {new Date(event.created_at).toLocaleString("en-PK", {
                    timeZone: "Asia/Karachi",
                  })}{" "}
                  PKT
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.h2}>Need a hand?</Text>
            <Text style={s.muted}>
              Changes after printing begins require support. Refunds and
              reprints are arranged with the printer; the app does not move
              money.
            </Text>
            <Choices
              label="What happened?"
              value={category}
              choices={[
                { value: "wrong_output", label: "Print issue" },
                { value: "missed_deadline", label: "Late order" },
                { value: "nonpayment", label: "Payment" },
                { value: "cancellation", label: "Cancellation" },
                { value: "other", label: "Other" },
              ]}
              onChange={setCategory}
            />
            <Field
              label="Tell us what happened"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={3000}
            />
            <Button
              title="Send support request"
              busy={busy}
              disabled={reason.trim().length < 5}
              onPress={async () => {
                if (await act("issue", { category, description: reason })) {
                  setReason("");
                  Alert.alert(
                    "Issue reported",
                    "Your case is saved for review.",
                  );
                }
              }}
            />
          </View>
          {order.status === "confirmed" && (
            <Button
              title="Cancel before printing"
              outline
              busy={busy}
              disabled={reason.trim().length < 5}
              onPress={() =>
                Alert.alert(
                  "Cancel this job?",
                  "Enter a reason above. Cancellation is only available before printing starts.",
                  [
                    { text: "Keep order", style: "cancel" },
                    {
                      text: "Cancel job",
                      style: "destructive",
                      onPress: () => {
                        void act("transition", {
                          version: order.row_version,
                          status: "cancelled",
                          reason,
                        });
                      },
                    },
                  ],
                )
              }
            />
          )}
          {order.issues.map((issue) => (
            <View key={issue.id} style={s.card}>
              <Badge text={label(issue.state)} />
              <Text style={s.h3}>{label(issue.category)}</Text>
              <Text style={s.text}>{issue.description}</Text>
              {issue.resolution && (
                <Text style={s.muted}>{issue.resolution}</Text>
              )}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
