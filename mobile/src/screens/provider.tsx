import React, { useState } from "react";
import { View, Text, Switch } from "react-native";
import { useApp } from "../core/provider";
import { useQuery } from "../core/query";
import { useAppNavigation } from "../navigation";
import {
  type RequestSummary,
  type History,
  label,
  formatMoney,
} from "../core/types";
import {
  Screen,
  PreviewNotice,
  Button,
  Field,
  Choices,
  ErrorNotice,
  Empty,
  Badge,
} from "../components/ui";
import { RequestCard } from "./home";
import { styles as s } from "../theme";
export function FeedScreen() {
  const { session } = useApp(),
    navigation = useAppNavigation();
  const query = useQuery<{ requests: RequestSummary[] }>(
    session?.provider?.state === "active" ? "feed" : null,
  );
  const history = useQuery<History>(session?.provider ? "history" : null);
  return (
    <Screen refresh={query.refresh} loading={query.loading}>
      <PreviewNotice />
      <Text style={s.eyebrow}>PRINTER MODE</Text>
      <Text style={s.title}>Good work starts here.</Text>
      <Text style={s.muted}>
        Requests matching your service area and printing capabilities.
      </Text>
      {session?.provider?.state !== "active" ? (
        <View style={s.card}>
          <Badge text={label(session?.provider?.state ?? "not_applied")} />
          <Text style={s.text}>
            Providers need manual approval before receiving requests or viewing
            files.
          </Text>
          <Button
            title="Review provider setup"
            outline
            onPress={() =>
              navigation.navigate(
                session?.provider ? "ProviderSettings" : "ProviderSetup",
              )
            }
          />
        </View>
      ) : (
        <>
          <ErrorNotice message={query.error} />
          {query.data?.requests.length ? (
            query.data.requests.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))
          ) : (
            <Empty
              icon="print-outline"
              title="You're ready for the next request"
              text="Matching jobs appear here. In preview mode, create a sample request in customer mode, then switch back."
            />
          )}
        </>
      )}
      {!!history.data?.offers?.length && (
        <>
          <Text style={s.h2}>Your recent offers</Text>
          {history.data.offers.map((o) => (
            <View key={o.id} style={s.card}>
              <Badge text={label(o.status)} />
              <Text style={s.h3}>{o.title}</Text>
              <Text style={s.text}>
                {formatMoney(o.total_paisa)} · {o.duration_minutes} minutes
              </Text>
              <Button
                title={o.order_id ? "Open order" : "Open request"}
                outline
                onPress={() =>
                  o.order_id
                    ? navigation.navigate("Order", { id: o.order_id })
                    : navigation.navigate("Request", { id: o.request_id })
                }
              />
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
export function ProviderSetupScreen() {
  const { service, reload } = useApp(),
    navigation = useAppNavigation();
  const [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState("");
  const [type, setType] = useState("shop"),
    [pickup, setPickup] = useState(true),
    [delivery, setDelivery] = useState(true),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Screen>
      <PreviewNotice />
      <Text style={s.title}>Your printer.{"\n"}Your next opportunity.</Text>
      <Text style={s.muted}>
        Apply as a print shop or home-based provider. We review each application
        before activating access.
      </Text>
      <ErrorNotice message={error} />
      <Field
        label="Business / provider name"
        value={name}
        onChangeText={setName}
      />
      <Choices
        label="Business type"
        value={type}
        choices={[
          { value: "shop", label: "Print shop" },
          { value: "home", label: "Home-based" },
        ]}
        onChange={setType}
      />
      <Field
        label="Responsible person"
        value={contact}
        onChangeText={setContact}
      />
      <Field
        label="Contact phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Field
        label="Production / pickup address"
        value={address}
        onChangeText={setAddress}
        multiline
      />
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.text}>Offer shop pickup</Text>
          <Switch
            accessibilityLabel="Offer shop pickup"
            value={pickup}
            onValueChange={setPickup}
          />
        </View>
        <View style={s.between}>
          <Text style={s.text}>Arrange delivery</Text>
          <Switch
            accessibilityLabel="Offer delivery"
            value={delivery}
            onValueChange={setDelivery}
          />
        </View>
        <Text style={s.muted}>
          If pickup is offered, your pickup address will be visible to
          prospective customers. This includes home addresses.
        </Text>
        <View style={s.between}>
          <Text style={[s.text, s.grow]}>
            I agree to the pickup-address visibility and document-use
            requirements.
          </Text>
          <Switch
            accessibilityLabel="Provider consent"
            value={consent}
            onValueChange={setConsent}
          />
        </View>
      </View>
      <Button
        title="Send application"
        disabled={!consent}
        busy={busy}
        onPress={async () => {
          if (
            name.trim().length < 2 ||
            contact.trim().length < 2 ||
            phone.length < 7 ||
            address.length < 5 ||
            (!pickup && !delivery)
          ) {
            setError(
              "Complete your contact details and choose at least one fulfillment option.",
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            await service.mutate("apply_provider", {
              name,
              type,
              contact,
              phone,
              address,
              pickup,
              delivery,
              consent,
            });
            await reload();
            navigation.replace("ProviderSettings");
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
export function ProviderSettingsScreen() {
  const { session, service, reload } = useApp(),
    navigation = useAppNavigation(),
    provider = session?.provider;
  const [hours, setHours] = useState(provider?.hours ?? "");
  const [paper, setPaper] = useState(
    provider?.capabilities.sizes.includes("A3") ? "both" : "A4",
  );
  const [color, setColor] = useState(
    provider?.capabilities.colors.includes("color") ? "both" : "bw",
  );
  const [duplex, setDuplex] = useState(provider?.capabilities.duplex ?? false),
    [stapled, setStapled] = useState(
      provider?.capabilities.finishing.includes("stapled") ?? false,
    ),
    [accepting, setAccepting] = useState(provider?.accepting ?? true);
  const [lat, setLat] = useState(""),
    [lng, setLng] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Screen>
      <PreviewNotice />
      <Text style={s.title}>Your printing setup</Text>
      <ErrorNotice message={error} />
      <Badge text={label(provider?.state ?? "pending")} />
      <Field
        label="Operating hours"
        value={hours}
        onChangeText={setHours}
        placeholder="e.g. Mon–Sat, 9am–8pm"
      />
      <Choices
        label="Paper sizes"
        value={paper}
        choices={[
          { value: "A4", label: "A4" },
          { value: "both", label: "A4 & A3" },
        ]}
        onChange={setPaper}
      />
      <Choices
        label="Printing"
        value={color}
        choices={[
          { value: "bw", label: "B&W" },
          { value: "both", label: "B&W & color" },
        ]}
        onChange={setColor}
      />
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.text}>Double-sided</Text>
          <Switch
            accessibilityLabel="Supports double-sided printing"
            value={duplex}
            onValueChange={setDuplex}
          />
        </View>
        <View style={s.between}>
          <Text style={s.text}>Stapling</Text>
          <Switch
            accessibilityLabel="Supports stapling"
            value={stapled}
            onValueChange={setStapled}
          />
        </View>
        <View style={s.between}>
          <Text style={s.text}>Accepting jobs</Text>
          <Switch
            accessibilityLabel="Accepting jobs"
            value={accepting}
            onValueChange={setAccepting}
          />
        </View>
      </View>
      <Text style={s.muted}>
        An optional accurate pickup pin enables radius matching. Changing it may
        require approval again. Your service zone is assigned during manual
        review.
      </Text>
      <Field
        label="Pickup latitude (optional)"
        value={lat}
        onChangeText={setLat}
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Pickup longitude (optional)"
        value={lng}
        onChangeText={setLng}
        keyboardType="numbers-and-punctuation"
      />
      <Button
        title="Save setup"
        busy={busy}
        onPress={async () => {
          if (
            hours.trim().length < 2 ||
            !!lat !== !!lng ||
            (lat &&
              (!Number.isFinite(Number(lat)) ||
                Math.abs(Number(lat)) > 90 ||
                !Number.isFinite(Number(lng)) ||
                Math.abs(Number(lng)) > 180))
          ) {
            setError(
              "Enter operating hours and valid coordinates, or leave both coordinates blank.",
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            await service.mutate("provider_settings", {
              hours,
              accepting,
              capabilities: {
                sizes: paper === "both" ? ["A4", "A3"] : ["A4"],
                colors: color === "both" ? ["bw", "color"] : ["bw"],
                duplex,
                finishing: stapled ? ["loose", "stapled"] : ["loose"],
              },
              ...(lat
                ? { coordinates: { lat: Number(lat), lng: Number(lng) } }
                : {}),
            });
            await reload();
            navigation.goBack();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
