import React, { useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Switch } from "react-native";
import { AppAlert as Alert } from "../components/alert";
import { useRoute, type RouteProp } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import type { RootStack } from "../navigation";
import { useAppNavigation } from "../navigation";
import { useApp } from "../core/provider";
import { useQuery } from "../core/query";
import {
  type PrintRequest,
  type Offer,
  formatMoney,
  label,
  parsePages,
  printCounts,
} from "../core/types";
import {
  Screen,
  PreviewNotice,
  ErrorNotice,
  Button,
  Icon,
  Badge,
  Field,
  Choices,
  Countdown,
  Empty,
} from "../components/ui";
import { styles as s, colors } from "../theme";
export function RequestScreen() {
  const { params } = useRoute<RouteProp<RootStack, "Request">>();
  const navigation = useAppNavigation(),
    { service, demo } = useApp();
  const query = useQuery<PrintRequest>("request/" + params.id);
  const r = query.data;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [sort, setSort] = useState("newest"),
    [consent, setConsent] = useState(false);
  const [printing, setPrinting] = useState(""),
    [delivery, setDelivery] = useState(""),
    [duration, setDuration] = useState("30");
  const [payment, setPayment] = useState("cash"),
    [note, setNote] = useState("");
  const [pages, setPages] = useState<Record<string, string>>({});
  const acceptKeys = useRef(new Map<string, string>()),
    offerKey = useRef(Crypto.randomUUID());
  async function act(action: string, input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await service.mutate<{ id?: string }>(action, input);
      if (action === "accept" && result.id)
        navigation.replace("Order", { id: result.id });
      else {
        await query.refresh();
        if (action === "offer") offerKey.current = Crypto.randomUUID();
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!r)
    return (
      <Screen>
        <ErrorNotice message={query.error} />
        {query.loading && <ActivityIndicator color={colors.orange} />}
        <Button
          title="Try again"
          outline
          onPress={() => {
            void query.refresh();
          }}
        />
      </Screen>
    );
  const ready = r.files.length > 0 && r.files.every((f) => f.state === "ready");
  const offers = [...r.offers].sort((a, b) =>
    sort === "price"
      ? a.total_paisa - b.total_paisa
      : sort === "time"
        ? a.duration_minutes - b.duration_minutes
        : Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const known = r.files.every((f) => f.pages !== null);
  let totals: {
      logicalPages: number;
      printedSides: number;
      sheets: number;
    } | null = null,
    countError = "";
  if (ready && known) {
    try {
      totals = printCounts(
        r.files.map((f) => {
          const settings = { ...r.settings, ...r.settings.files?.[f.id] };
          return {
            pages: parsePages(pages[f.id] ?? settings.pages ?? "", f.pages!)
              .length,
            copies: settings.copies,
            duplex: settings.duplex,
          };
        }),
      );
    } catch (error) {
      countError = (error as Error).message;
    }
  }
  async function publish() {
    if (!r || !consent) return;
    setBusy(true);
    setError("");
    try {
      let revision = r.revision;
      const changed = Object.entries(pages).some(
        ([fileId, value]) =>
          value !== (r.settings.files?.[fileId]?.pages ?? ""),
      );
      if (changed) {
        const overrides = { ...r.settings.files };
        for (const [fileId, value] of Object.entries(pages))
          overrides[fileId] = { ...overrides[fileId], pages: value };
        await service.mutate("edit_request", {
          id: r.id,
          revision,
          settings: { ...r.settings, files: overrides },
        });
        const fresh = await service.read<PrintRequest>("request/" + r.id);
        revision = fresh.revision;
      }
      await service.mutate("publish", {
        id: r.id,
        revision,
        consent: "file-sharing-v1",
      });
      await query.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function accept(offer: Offer) {
    if (!r) return;
    Alert.alert(
      "Confirm this printer?",
      formatMoney(offer.total_paisa) +
        " total · " +
        (r.mode === "pickup" ? "Ready for pickup" : "Delivered") +
        " within " +
        offer.duration_minutes +
        " minutes of acceptance.\nPayment: " +
        label(offer.payment_method) +
        " at handover.\n\nThis commits the printing job.",
      [
        { text: "Back", style: "cancel" },
        {
          text: "Accept offer",
          onPress: () => {
            if (!acceptKeys.current.has(offer.id))
              acceptKeys.current.set(offer.id, Crypto.randomUUID());
            void act("accept", {
              id: offer.id,
              revision: r.revision,
              key: acceptKeys.current.get(offer.id),
            });
          },
        },
      ],
    );
  }
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <View style={s.between}>
        <Badge text={label(r.state)} orange={r.state === "open"} />
        {r.expires_at && r.state === "open" && (
          <Countdown expires={r.expires_at} serverNow={r.server_now} />
        )}
      </View>
      <Text style={s.title}>{r.title}</Text>
      <Text style={s.muted}>
        {r.mode === "pickup" ? "Shop pickup" : "Delivery"} · {r.area} ·{" "}
        {label(r.urgency)}
      </Text>
      <ErrorNotice message={error || query.error} />
      {r.order_id && (
        <Button
          title="Open your order"
          icon="receipt-outline"
          onPress={() => navigation.replace("Order", { id: r.order_id! })}
        />
      )}
      <View style={s.card}>
        <Text style={s.h2}>Your files</Text>
        {r.files.map((file) => (
          <View key={file.id} style={{ gap: 10 }}>
            <View style={s.row}>
              <View style={[s.circle, { backgroundColor: colors.peach }]}>
                <Icon
                  name={
                    file.kind === "pdf"
                      ? "document-text-outline"
                      : "image-outline"
                  }
                  color={colors.orange}
                />
              </View>
              <View style={s.grow}>
                <Text style={s.h3}>{file.name}</Text>
                <Text style={s.muted}>
                  {file.pages !== null
                    ? file.pages + " page" + (file.pages === 1 ? "" : "s")
                    : "Page count not verified"}{" "}
                  · {label(file.state)}
                </Text>
              </View>
              {file.state === "ready" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Preview " + file.name}
                  onPress={() =>
                    navigation.navigate("FilePreview", {
                      id: file.id,
                      name: file.name,
                    })
                  }
                  hitSlop={10}
                >
                  <Icon name="eye-outline" />
                </Pressable>
              )}
            </View>
            {!!file.error && <ErrorNotice message={file.error} />}
            {r.mine &&
              r.state === "draft" &&
              file.state === "ready" &&
              file.pages !== null && (
                <Field
                  label={"Pages to print: " + file.name}
                  value={
                    pages[file.id] ?? r.settings.files?.[file.id]?.pages ?? ""
                  }
                  onChangeText={(value) =>
                    setPages({ ...pages, [file.id]: value })
                  }
                  placeholder="All pages, or e.g. 1, 3-5"
                />
              )}
          </View>
        ))}
        <View style={s.divider} />
        <Text style={s.text}>
          {r.settings.size} ·{" "}
          {r.settings.color === "bw" ? "Black & white" : "Color"} ·{" "}
          {r.settings.copies} cop{r.settings.copies === 1 ? "y" : "ies"}
          {"\n"}
          {r.settings.duplex ? "Double-sided" : "Single-sided"} ·{" "}
          {label(r.settings.finishing)}
        </Text>
        {totals && (
          <Text style={s.h3}>
            {totals.logicalPages} selected pages · {totals.printedSides} printed
            sides · {totals.sheets} sheets
          </Text>
        )}
        {countError && <ErrorNotice message={countError} />}
        {demo && !known && (
          <Text style={s.muted}>
            PDF page counts are unavailable on this platform. Android counts
            selected PDFs on the device. Offers here are illustrative sample
            prices.
          </Text>
        )}
        {!!r.instructions && (
          <Text style={s.muted}>Instructions: {r.instructions}</Text>
        )}
      </View>
      {r.mine && r.state === "draft" && (
        <>
          {!ready && (
            <View style={s.card}>
              <ActivityIndicator color={colors.orange} />
              <Text style={s.text}>
                Checking your files and preparing previews…
              </Text>
              <Text style={s.muted}>
                You can return to this request from Orders. Failed files must be
                removed and uploaded again.
              </Text>
            </View>
          )}
          {r.files.some((f) => f.state === "failed") &&
            r.files
              .filter((f) => f.state === "failed")
              .map((f) => (
                <Button
                  key={f.id}
                  title={"Remove " + f.name}
                  outline
                  busy={busy}
                  onPress={() => {
                    void act("remove_file", { id: f.id });
                  }}
                />
              ))}
          <View style={s.card}>
            <Text style={s.h2}>Ready to get offers?</Text>
            <Text style={s.text}>
              Posting lets approved printers in your selected area review these
              files. Your exact delivery address and phone are shared only with
              the printer you accept.
            </Text>
            <View style={s.between}>
              <Text style={[s.text, s.grow]}>
                I agree to share these files for offers.
              </Text>
              <Switch
                accessibilityLabel="Consent to provider document review"
                value={consent}
                onValueChange={setConsent}
                trackColor={{ true: colors.green }}
              />
            </View>
            <Button
              title={demo ? "Show sample offers" : "Post print request"}
              icon="arrow-forward"
              busy={busy}
              disabled={!ready || !consent || !!countError}
              onPress={() => {
                void publish();
              }}
            />
          </View>
        </>
      )}
      {r.state === "open" && r.mine && (
        <>
          <Text style={s.h2}>Choose your printer</Text>
          <Choices
            label="Sort offers"
            value={sort}
            choices={[
              { value: "newest", label: "Newest" },
              { value: "price", label: "Lowest price" },
              { value: "time", label: "Fastest" },
            ]}
            onChange={setSort}
          />
          {!offers.length && (
            <Empty
              icon="hourglass-outline"
              title="Your request is out there"
              text="Approved printers in your area can review it and send an offer. Keep notifications enabled."
            />
          )}
          {offers.map((offer) => (
            <View key={offer.id} style={s.card}>
              <View style={s.between}>
                <Text style={[s.h2, { fontSize: 27 }]}>
                  {formatMoney(offer.total_paisa)}
                </Text>
                <Countdown
                  expires={offer.expires_at}
                  serverNow={r.server_now}
                />
              </View>
              <Text style={s.muted}>
                Print {formatMoney(offer.print_paisa)} + delivery{" "}
                {formatMoney(offer.delivery_paisa)}
              </Text>
              <View style={s.divider} />
              <View style={s.row}>
                <View style={[s.circle, { backgroundColor: colors.mint }]}>
                  <Icon name="print-outline" color={colors.green} />
                </View>
                <View style={s.grow}>
                  <Text style={s.h3}>{offer.provider_name}</Text>
                  <Text style={s.muted}>
                    New provider · {offer.duration_minutes} minutes
                  </Text>
                </View>
              </View>
              {r.mode === "pickup" && (
                <Text style={s.text}>{offer.pickup_address}</Text>
              )}
              <Text style={s.muted}>
                {label(offer.payment_method)} at handover
                {offer.note ? " · " + offer.note : ""}
              </Text>
              {offer.status === "active" && (
                <>
                  <Button
                    title="Choose this printer"
                    busy={busy}
                    onPress={() => accept(offer)}
                  />
                  <Button
                    title="Decline"
                    outline
                    disabled={busy}
                    onPress={() => {
                      void act("decline", { id: offer.id });
                    }}
                  />
                </>
              )}
              {offer.status !== "active" && (
                <Badge text={label(offer.status)} />
              )}
            </View>
          ))}
        </>
      )}
      {r.state === "open" && !r.mine && (
        <View style={s.card}>
          <Text style={s.h2}>Send your offer</Text>
          <Text style={s.muted}>
            Valid for five minutes. Include finishing and packaging in the
            printing price.
          </Text>
          <Field
            label="Printing amount (Rs.)"
            value={printing}
            onChangeText={setPrinting}
            keyboardType="decimal-pad"
          />
          {r.mode === "delivery" && (
            <Field
              label="Delivery amount (Rs.)"
              value={delivery}
              onChangeText={setDelivery}
              keyboardType="decimal-pad"
            />
          )}
          <Field
            label={
              (r.mode === "pickup" ? "Ready" : "Delivered") +
              " within (minutes)"
            }
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />
          <Choices
            label="Payment at handover"
            value={payment}
            choices={[
              { value: "cash", label: "Cash" },
              { value: "transfer", label: "Direct transfer" },
            ]}
            onChange={setPayment}
          />
          <Field
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />
          <Button
            title="Send offer"
            busy={busy}
            onPress={() => {
              if (
                !/^\d+(\.\d{1,2})?$/.test(printing) ||
                Number(printing) <= 0 ||
                !/^\d+$/.test(duration) ||
                Number(duration) < 1 ||
                (r.mode === "delivery" && !/^\d+(\.\d{1,2})?$/.test(delivery))
              ) {
                setError("Enter valid amounts and a whole completion time.");
                return;
              }
              void act("offer", {
                id: r.id,
                revision: r.revision,
                key: offerKey.current,
                print_paisa: Math.round(Number(printing) * 100),
                delivery_paisa:
                  r.mode === "pickup" ? 0 : Math.round(Number(delivery) * 100),
                duration_minutes: Number(duration),
                payment_method: payment,
                note,
              });
            }}
          />
          {r.offers
            .filter((o) => o.status === "active")
            .map((o) => (
              <View key={o.id} style={{ gap: 12 }}>
                <Text style={s.text}>
                  Your offer: {formatMoney(o.total_paisa)}
                </Text>
                <Countdown expires={o.expires_at} serverNow={r.server_now} />
                <Button
                  title="Withdraw offer"
                  outline
                  busy={busy}
                  onPress={() => {
                    void act("withdraw", { id: o.id });
                  }}
                />
              </View>
            ))}
          <Button
            title="Request clearer instructions"
            outline
            busy={busy}
            onPress={() => {
              void act("clarify", {
                id: r.id,
                revision: r.revision,
                category: "instructions",
              });
            }}
          />
        </View>
      )}
      {r.clarifications?.map((c) => (
        <View key={c.id} style={s.card}>
          <Text style={s.h3}>{c.provider_name} needs clarification</Text>
          <Text style={s.muted}>
            {label(c.category)}. Edit and repost to update your instructions.
          </Text>
        </View>
      ))}
      {r.mine && ["draft", "open"].includes(r.state) && (
        <Button
          title="Cancel request"
          outline
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Cancel this request?",
              "Printers will lose access and existing offers will close.",
              [
                { text: "Keep request", style: "cancel" },
                {
                  text: "Cancel request",
                  style: "destructive",
                  onPress: () => {
                    void act("cancel_request", {
                      id: r.id,
                      revision: r.revision,
                    });
                  },
                },
              ],
            )
          }
        />
      )}
    </Screen>
  );
}
