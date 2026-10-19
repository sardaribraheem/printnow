import React, { useRef, useState } from "react";
import { View, Text, Pressable, Image, Switch } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { optionalPoint } from "../core/location";
import { removeSelectedCopy } from "../core/files";
import type { RootStack, SelectedFile } from "../navigation";
import { useAppNavigation } from "../navigation";
import { useApp } from "../core/provider";
import { styles as s, colors } from "../theme";
import {
  validateUploadBatch,
  printCounts,
  type PrintSettings,
} from "../core/types";
import {
  Screen,
  Button,
  Field,
  Choices,
  PreviewNotice,
  ErrorNotice,
  Icon,
} from "../components/ui";
import { pickFiles } from "./home";
export function ComposeScreen() {
  const route = useRoute<RouteProp<RootStack, "Compose">>(),
    navigation = useAppNavigation();
  const { service, session, demo } = useApp();
  const [files, setFiles] = useState<SelectedFile[]>(route.params?.files ?? []);
  const [step, setStep] = useState(0),
    [title, setTitle] = useState("");
  const [size, setSize] = useState<"A4" | "A3">("A4"),
    [color, setColor] = useState<"bw" | "color">("bw");
  const [copies, setCopies] = useState("1"),
    [duplex, setDuplex] = useState(false);
  const [finishing, setFinishing] = useState<"loose" | "stapled">("loose");
  const [mode, setMode] = useState<"pickup" | "delivery">(
    session?.user.preferred_fulfillment ?? "pickup",
  );
  const [urgency, setUrgency] = useState("standard");
  const [area, setArea] = useState(session?.zones[0]?.name ?? "");
  const [zone, setZone] = useState(session?.zones[0]?.id ?? "");
  const [name, setName] = useState(
    session?.address?.recipient_name ?? session?.user.display_name ?? "",
  );
  const [phone, setPhone] = useState(
    session?.address?.phone ?? session?.user.contact_phone ?? "",
  );
  const [address, setAddress] = useState(session?.address?.full_address ?? "");
  const [landmark, setLandmark] = useState(session?.address?.landmark ?? "");
  const [latitude, setLatitude] = useState(
    session?.address?.lat?.toString() ?? "",
  );
  const [longitude, setLongitude] = useState(
    session?.address?.lng?.toString() ?? "",
  );
  const [manualPin, setManualPin] = useState(false),
    [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState("5");
  const [instructions, setInstructions] = useState("");
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const requestKey = useRef(Crypto.randomUUID()),
    requestId = useRef<string | null>(null);
  const uploaded = useRef(new Map<string, string>()),
    registered = useRef(new Map<string, string>());
  const uploadKeys = useRef(new Map<string, string>());
  let localCounts: ReturnType<typeof printCounts> | null = null;
  let localCountError = "";
  if (files.length && files.every((file) => file.pages !== undefined)) {
    try {
      localCounts = printCounts(
        files.map((file) => ({
          pages: file.pages!,
          copies: Number(copies),
          duplex,
        })),
      );
    } catch (error) {
      localCountError = (error as Error).message;
    }
  }
  async function add() {
    try {
      const picked = await pickFiles();
      if (!picked) return;
      const combined = [...files, ...picked];
      const message = validateUploadBatch(combined);
      if (message) {
        for (const file of picked) removeSelectedCopy(file.uri);
        throw new Error(message);
      }
      setFiles(combined);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function next() {
    setError("");
    const message = validateUploadBatch(files);
    if (!files.length || message) {
      setError(message ?? "Choose at least one file.");
      return;
    }
    if (!/^\d+$/.test(copies) || Number(copies) < 1 || Number(copies) > 200) {
      setError(
        "Choose 1–200 whole copies. The request limit is 200 printed sides.",
      );
      return;
    }
    if (localCountError) {
      setError(localCountError);
      return;
    }
    if (
      step === 1 &&
      (!area.trim() ||
        !zone ||
        (mode === "delivery" &&
          (!name.trim() || !phone.trim() || !address.trim())))
    ) {
      setError("Complete your area and delivery details.");
      return;
    }
    try {
      optionalPoint(latitude, longitude);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    setStep(Math.min(2, step + 1));
  }
  async function save() {
    if (!session) {
      navigation.navigate("Auth");
      return;
    }
    if (!session.user.contact_phone || !session.user.display_name) {
      navigation.navigate("Profile");
      return;
    }
    if (!consent) {
      setError("Review the file-sharing notice and confirm before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const settings: PrintSettings = {
        size,
        color,
        copies: Number(copies),
        duplex,
        duplex_edge: "long",
        finishing,
        scaling: "fit",
      };
      if (!requestId.current) {
        const point = optionalPoint(latitude, longitude);
        const created = await service.mutate<{ id: string }>("create_request", {
          key: requestKey.current,
          title: title.trim() || files[0].name.replace(/\.[^.]+$/, ""),
          mode,
          urgency,
          zone_id: zone,
          area,
          radius_km: mode === "pickup" && point ? Number(radius) : null,
          coordinates: point,
          settings,
          instructions,
          latest_needed_at: null,
          destination:
            mode === "delivery" ? { name, phone, address, landmark } : null,
        });
        requestId.current = created.id;
      }
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (uploaded.current.has(file.uri)) continue;
        setProgress("Saving file " + (index + 1) + " of " + files.length + "…");
        if (!uploadKeys.current.has(file.uri))
          uploadKeys.current.set(file.uri, Crypto.randomUUID());
        try {
          const id = await service.upload(
            requestId.current,
            file,
            registered.current.get(file.uri),
            uploadKeys.current.get(file.uri),
          );
          uploaded.current.set(file.uri, id);
        } catch (error) {
          const id = (error as Error & { registeredId?: string }).registeredId;
          if (id) registered.current.set(file.uri, id);
          throw error;
        }
      }
      navigation.replace("Request", { id: requestId.current });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Screen>
      <PreviewNotice />
      <View style={s.between}>
        <Text style={s.eyebrow}>YOUR NEXT PRINT</Text>
        <Text style={s.muted}>Step {step + 1} of 3</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? colors.orange : colors.line,
            }}
          />
        ))}
      </View>
      <Text style={s.title}>
        {["Make it yours.", "Where should it go?", "One last look."][step]}
      </Text>
      <ErrorNotice message={error} />
      {step === 0 ? (
        <>
          <Text style={s.muted}>
            Choose up to 3 files, 25 MiB each. Each image is one page. Android
            checks page counts on your phone. Live orders also require server
            validation.
          </Text>
          {files.map((file, index) => (
            <View style={s.card} key={file.uri + index}>
              <View style={s.row}>
                {file.mimeType.startsWith("image/") ? (
                  <Image
                    accessibilityLabel={file.name}
                    source={{ uri: file.uri }}
                    style={{
                      width: 48,
                      height: 58,
                      borderRadius: 8,
                      backgroundColor: colors.background,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[s.circle, { backgroundColor: colors.peach }]}>
                    <Icon name="document-text-outline" color={colors.orange} />
                  </View>
                )}
                <View style={s.grow}>
                  <Text style={s.h3} numberOfLines={2}>
                    {file.name}
                  </Text>
                  <Text style={s.muted}>
                    {(file.size / 1024 / 1024).toFixed(2)} MiB
                    {file.pages
                      ? " · " +
                        file.pages +
                        (file.pages === 1 ? " page" : " pages")
                      : ""}
                  </Text>
                </View>
                {!requestId.current && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Remove " + file.name}
                    hitSlop={12}
                    onPress={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                  >
                    <Icon name="close-circle-outline" color={colors.muted} />
                  </Pressable>
                )}
              </View>
              <Button
                title={"Preview " + file.name}
                outline
                onPress={() => navigation.navigate("LocalPreview", { file })}
              />
            </View>
          ))}
          {!requestId.current && files.length < 3 && (
            <Button
              title={files.length ? "Add another file" : "Choose files"}
              outline
              icon="add"
              onPress={() => {
                void add();
              }}
            />
          )}
          <Field
            label="Request name (optional)"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="e.g. Semester assignment"
            editable={!requestId.current}
          />
          <View style={s.card}>
            <Text style={s.h2}>Print settings</Text>
            <Choices
              label="Paper size"
              value={size}
              choices={[
                { value: "A4", label: "A4" },
                { value: "A3", label: "A3" },
              ]}
              onChange={setSize}
            />
            <Choices
              label="Color"
              value={color}
              choices={[
                { value: "bw", label: "Black & white" },
                { value: "color", label: "Color" },
              ]}
              onChange={setColor}
            />
            <Field
              label="Copies"
              value={copies}
              onChangeText={setCopies}
              keyboardType="number-pad"
              maxLength={3}
            />
            <View style={s.between}>
              <View>
                <Text style={s.h3}>Double-sided</Text>
                <Text style={s.muted}>Flip on the long edge</Text>
              </View>
              <Switch
                accessibilityLabel="Double-sided printing"
                value={duplex}
                onValueChange={setDuplex}
                trackColor={{ true: colors.green }}
              />
            </View>
            <Choices
              label="Finishing"
              value={finishing}
              choices={[
                { value: "loose", label: "Loose sheets" },
                { value: "stapled", label: "Stapled" },
              ]}
              onChange={setFinishing}
            />
            <Text style={s.muted}>
              All pages · Fit to paper · Standard white stock{"\n"}Each file and
              each copy starts on a new sheet. Final counts are verified before
              posting.
            </Text>
            {localCounts && (
              <Text style={s.h3}>
                {localCounts.logicalPages} pages · {localCounts.printedSides}{" "}
                printed sides · {localCounts.sheets} sheets
              </Text>
            )}
            <ErrorNotice message={localCountError} />
          </View>
          <Button
            title="Continue"
            icon="arrow-forward"
            onPress={next}
            disabled={busy}
          />
        </>
      ) : step === 1 ? (
        <>
          <Choices
            label="Fulfillment"
            value={mode}
            choices={[
              { value: "pickup", label: "I'll collect" },
              { value: "delivery", label: "Deliver to me" },
            ]}
            onChange={setMode}
          />
          <Field
            label="Area / campus"
            value={area}
            onChangeText={setArea}
            placeholder="e.g. NIIT, Lahore"
          />
          {!!session?.zones.length && (
            <Choices
              label="Service zone"
              value={zone}
              choices={session.zones.map((z) => ({
                value: z.id,
                label: z.name,
              }))}
              onChange={setZone}
            />
          )}
          {mode === "delivery" ? (
            <View style={s.card}>
              <Text style={s.h2}>Delivery details</Text>
              <Field
                label="Recipient name"
                value={name}
                onChangeText={setName}
              />
              <Field
                label="Contact phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Field
                label="Full address"
                value={address}
                onChangeText={setAddress}
                multiline
              />
              <Field
                label="Landmark (optional)"
                value={landmark}
                onChangeText={setLandmark}
              />
              <Text style={s.muted}>
                Your exact address and phone are shared with the printer you
                accept.
              </Text>
            </View>
          ) : (
            <View style={s.card}>
              <Icon name="storefront-outline" color={colors.green} />
              <Text style={s.text}>
                Compare each printer's collection address before accepting. Add
                your location to filter by travel distance, or search your
                selected service zone.
              </Text>
            </View>
          )}
          <View style={s.card}>
            <Text style={s.h3}>
              {latitude && longitude
                ? "Location pin added"
                : "Find printers near you"}
            </Text>
            <Text style={s.muted}>
              {latitude && longitude
                ? "Your exact pin stays private until you accept a delivery provider."
                : "Location is optional. You can continue using your selected service zone."}
            </Text>
            <Button
              title="Use current location"
              outline
              icon="locate-outline"
              busy={locating}
              onPress={async () => {
                setLocating(true);
                setError("");
                try {
                  const permission =
                    await Location.requestForegroundPermissionsAsync();
                  if (!permission.granted)
                    throw new Error(
                      "Location permission was not granted. Continue with your service zone or enter a pickup pin manually.",
                    );
                  const position = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  setLatitude(String(position.coords.latitude));
                  setLongitude(String(position.coords.longitude));
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setLocating(false);
                }
              }}
            />
            <Button
              title={manualPin ? "Hide manual pin" : "Enter a pin manually"}
              outline
              onPress={() => setManualPin(!manualPin)}
            />
            {manualPin && (
              <>
                <Field
                  label="Latitude"
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numbers-and-punctuation"
                />
                <Field
                  label="Longitude"
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}
            {latitude && longitude && (
              <>
                <Button
                  title="Remove location pin"
                  outline
                  onPress={() => {
                    setLatitude("");
                    setLongitude("");
                  }}
                />
                {mode === "pickup" && (
                  <Choices
                    label="Maximum pickup distance"
                    value={radius}
                    choices={[
                      { value: "5", label: "5 km" },
                      { value: "10", label: "10 km" },
                      { value: "20", label: "20 km" },
                    ]}
                    onChange={setRadius}
                  />
                )}
              </>
            )}
          </View>
          <Choices
            label="How soon?"
            value={urgency}
            choices={[
              { value: "standard", label: "Standard" },
              { value: "urgent", label: "Urgent" },
            ]}
            onChange={setUrgency}
          />
          <Text style={s.muted}>
            Each printer offers their own completion time. Urgent is a
            preference, not a delivery guarantee.
          </Text>
          <Field
            label="Printing instructions (optional)"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={1000}
            placeholder="Anything your printer should know?"
          />
          <Button title="Review request" icon="arrow-forward" onPress={next} />
        </>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.h2}>{title.trim() || files[0]?.name}</Text>
            <Text style={s.text}>
              {files.length} file{files.length === 1 ? "" : "s"} · {size} ·{" "}
              {color === "bw" ? "Black & white" : "Color"}
              {"\n"}
              {copies} cop{copies === "1" ? "y" : "ies"} ·{" "}
              {duplex ? "Double-sided" : "Single-sided"} ·{" "}
              {finishing === "stapled" ? "Stapled" : "Loose sheets"}
            </Text>
            <View style={s.divider} />
            <Text style={s.text}>
              {mode === "pickup"
                ? "Shop pickup · " +
                  (latitude && longitude
                    ? radius + " km search"
                    : "selected service zone")
                : "Delivery to " + address}
              {"\n"}
              {area} · {urgency === "urgent" ? "Urgent" : "Standard"}
            </Text>
            <Text style={s.muted}>
              You will review validated page counts and confirm posting on the
              next screen.
            </Text>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent(!consent)}
            style={[s.card, s.row]}
          >
            <Icon
              name={consent ? "checkbox" : "square-outline"}
              color={consent ? colors.green : colors.muted}
            />
            <Text style={[s.text, s.grow]}>
              I understand that posting lets approved printers in my area review
              these files to prepare offers. Documents may contain personal
              information.
            </Text>
          </Pressable>
          {demo && (
            <Text style={s.muted}>
              This preview keeps selected files on your device and simulates
              offers. PDF page counts are not verified in preview mode.
            </Text>
          )}
          <Button
            title={
              !session
                ? "Sign in to continue"
                : demo
                  ? "Create sample request"
                  : "Save private draft"
            }
            busy={busy}
            disabled={!consent}
            onPress={() => {
              void save();
            }}
            icon="shield-checkmark-outline"
          />
          {!!progress && (
            <Text accessibilityLiveRegion="polite" style={s.muted}>
              {progress}
            </Text>
          )}
        </>
      )}
      {step > 0 && !busy && !requestId.current && (
        <Button title="Back" outline onPress={() => setStep(step - 1)} />
      )}
      {requestId.current && !busy && !!error && (
        <Button
          title="Open saved private draft"
          outline
          onPress={() =>
            navigation.replace("Request", { id: requestId.current! })
          }
        />
      )}
    </Screen>
  );
}
