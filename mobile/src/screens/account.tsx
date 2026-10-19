import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { AppAlert as Alert } from "../components/alert";
import * as WebBrowser from "expo-web-browser";
import { useApp } from "../core/provider";
import {
  configured,
  supabase,
  authMethods,
  finishAuthUrl,
} from "../core/client";
import { useAppNavigation } from "../navigation";
import {
  Screen,
  Button,
  Field,
  Choices,
  PreviewNotice,
  ErrorNotice,
  Icon,
  Badge,
} from "../components/ui";
import { styles as s, colors } from "../theme";
import { label } from "../core/types";
export function AccountScreen() {
  const {
    session,
    demo,
    providerMode,
    setProviderMode,
    signOut,
    sessionError,
    reload,
  } = useApp();
  const navigation = useAppNavigation();
  const [actionError, setActionError] = useState("");
  return (
    <Screen refresh={reload}>
      <PreviewNotice />
      <Text style={s.title}>Your account</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View
            style={[
              s.circle,
              {
                width: 62,
                height: 62,
                borderRadius: 31,
                backgroundColor: colors.mint,
              },
            ]}
          >
            <Icon name="person-outline" color={colors.green} size={27} />
          </View>
          <View style={s.grow}>
            <Text style={s.h2}>
              {session?.user.display_name || "Welcome to PrintNow"}
            </Text>
            <Text style={s.muted}>
              {demo
                ? "Sample account"
                : session?.user.contact_phone || "Sign in to start printing"}
            </Text>
          </View>
        </View>
        {session && (
          <Button
            title="Contact & delivery details"
            outline
            icon="location-outline"
            onPress={() => navigation.navigate("Profile")}
          />
        )}
      </View>
      <ErrorNotice message={actionError || sessionError} />
      {!session && (
        <Button
          title="Sign in or create an account"
          icon="log-in-outline"
          onPress={() => navigation.navigate("Auth")}
        />
      )}
      {session && (
        <View style={s.card}>
          <Text style={s.h2}>Print with us</Text>
          {session.provider ? (
            <>
              <View style={s.between}>
                <View style={s.grow}>
                  <Text style={s.h3}>{session.provider.display_name}</Text>
                  <Text style={s.muted}>
                    {demo
                      ? "Sample approved printer"
                      : label(session.provider.state)}
                  </Text>
                </View>
                <Badge text={label(session.provider.state)} />
              </View>
              <View style={s.between}>
                <Text style={s.text}>Printer mode</Text>
                <Switch
                  accessibilityLabel="Printer mode"
                  value={providerMode}
                  onValueChange={setProviderMode}
                  trackColor={{ true: colors.green }}
                />
              </View>
              <Button
                title="Printer capabilities & hours"
                outline
                onPress={() => navigation.navigate("ProviderSettings")}
              />
            </>
          ) : (
            <>
              <Text style={s.muted}>
                Have a shop or a home printing setup? Apply to receive local
                print requests.
              </Text>
              <Button
                title="Become a printing provider"
                outline
                icon="print-outline"
                onPress={() => navigation.navigate("ProviderSetup")}
              />
            </>
          )}
        </View>
      )}
      <View style={s.card}>
        <Text style={s.h2}>Good to know</Text>
        <Text style={s.text}>
          Pay your printer directly at handover. PrintNow charges zero platform
          order fees.
        </Text>
        <View style={s.divider} />
        <Text style={s.muted}>
          Files are private. Posting allows approved matching printers to review
          them. Only your selected printer receives your delivery contact
          details. Draft files expire after 24 hours; completed-order files are
          normally deleted after 7 days. Open disputes may require longer
          retention.
        </Text>
        <Button
          title="Notification preferences"
          outline
          icon="notifications-outline"
          onPress={() => navigation.navigate("Notifications")}
        />
      </View>
      {demo && (
        <Button
          title="Sign in to a live account"
          outline
          onPress={() => navigation.navigate("Auth")}
        />
      )}
      {session && (
        <Button
          title={demo ? "Reset sample session" : "Sign out"}
          outline
          onPress={() =>
            Alert.alert(
              demo ? "Reset preview?" : "Sign out?",
              demo
                ? "Sample requests and messages will be cleared."
                : "Your private session will be removed from this device.",
              [
                { text: "Back", style: "cancel" },
                {
                  text: demo ? "Reset" : "Sign out",
                  onPress: async () => {
                    try {
                      await signOut();
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Main" }],
                      });
                    } catch (error) {
                      setActionError((error as Error).message);
                    }
                  },
                },
              ],
            )
          }
        />
      )}
      <Text style={[s.muted, { textAlign: "center" }]}>
        PrintNow · Made for your everyday prints
      </Text>
    </Screen>
  );
}
export function AuthScreen() {
  const navigation = useAppNavigation(),
    app = useApp();
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    void authMethods().then((methods) => setGoogle(methods.google));
  }, []);
  const recovering = app.recovering;
  async function submit() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (recovering) {
        if (password.length < 8) throw new Error("Use at least 8 characters.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        app.setRecovering(false);
        app.useLiveAccount();
        navigation.replace("Profile");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: "printnow://auth/reset" },
        );
        if (error) throw error;
        setMessage(
          "If an account exists, a password-reset link has been sent.",
        );
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: "printnow://auth/callback" },
        });
        if (error) throw error;
        if (data.session) {
          app.useLiveAccount();
          navigation.replace("Profile");
        } else
          setMessage(
            "Check your email to confirm your account, then return here to sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        app.useLiveAccount();
        navigation.replace("Profile");
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function googleSignIn() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const redirectTo = "printnow://auth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url)
        throw error ?? new Error("Google sign-in is unavailable.");
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type === "success") {
        if (!(await finishAuthUrl(result.url)))
          throw new Error("The sign-in return link was invalid.");
        app.useLiveAccount();
        navigation.replace("Profile");
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View
        style={[
          s.circle,
          {
            backgroundColor: colors.peach,
            width: 64,
            height: 64,
            borderRadius: 20,
          },
        ]}
      >
        <Icon name="print-outline" color={colors.orange} size={29} />
      </View>
      <Text style={s.title}>
        {recovering
          ? "A fresh start."
          : mode === "signup"
            ? "Let's get you printing."
            : "Welcome back."}
      </Text>
      <Text style={s.muted}>
        Your files, offers and conversations. All in one place.
      </Text>
      <ErrorNotice message={error} />
      {!configured ? (
        <View style={s.card}>
          <Text style={s.h2}>You're trying a preview build</Text>
          <Text style={s.text}>
            Live sign-in and printing will be available in the connected beta.
            For now, you can explore sample offers and orders.
          </Text>
          <Button
            title="Explore the preview"
            onPress={() => {
              app.enterDemo();
              navigation.reset({ index: 0, routes: [{ name: "Main" }] });
            }}
          />
        </View>
      ) : (
        <>
          {!recovering && (
            <Choices
              label="Account"
              value={mode}
              choices={[
                { value: "login", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ]}
              onChange={(value) => {
                setMode(value);
                setError("");
                setMessage("");
              }}
            />
          )}
          {!recovering && (
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
          {mode !== "reset" && (
            <Field
              label={recovering ? "New password" : "Password"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={
                mode === "signup" || recovering
                  ? "new-password"
                  : "current-password"
              }
            />
          )}
          {!!message && (
            <View style={[s.card, { backgroundColor: colors.mint }]}>
              <Text style={s.text}>{message}</Text>
            </View>
          )}
          <Button
            title={
              recovering
                ? "Update password"
                : mode === "reset"
                  ? "Send reset link"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"
            }
            busy={busy}
            onPress={() => {
              void submit();
            }}
          />
          {google && !recovering && (
            <Button
              title="Continue with Google"
              outline
              icon="logo-google"
              busy={busy}
              onPress={() => {
                void googleSignIn();
              }}
            />
          )}
          {!recovering && (
            <Button
              title="Forgot password?"
              outline
              onPress={() => {
                setMode("reset");
                setMessage("");
              }}
            />
          )}
        </>
      )}
    </Screen>
  );
}
export function ProfileScreen() {
  const app = useApp(),
    navigation = useAppNavigation();
  const [name, setName] = useState(app.session?.user.display_name ?? ""),
    [phone, setPhone] = useState(app.session?.user.contact_phone ?? "");
  const [mode, setMode] = useState<"pickup" | "delivery">(
    app.session?.user.preferred_fulfillment ?? "pickup",
  );
  const [address, setAddress] = useState(
      app.session?.address?.full_address ?? "",
    ),
    [landmark, setLandmark] = useState(app.session?.address?.landmark ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (app.session) {
      setName(app.session.user.display_name);
      setPhone(app.session.user.contact_phone ?? "");
      setMode(app.session.user.preferred_fulfillment ?? "pickup");
      setAddress(app.session.address?.full_address ?? "");
      setLandmark(app.session.address?.landmark ?? "");
    }
    // Refresh initial values on identity changes without overwriting an edited
    // form every time the foreground session poll returns a new object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.session?.user.user_id]);
  return (
    <Screen>
      <PreviewNotice />
      <Text style={s.title}>A little about you.</Text>
      <Text style={s.muted}>
        Help your printer reach you. Your phone is a contact number and has not
        been verified.
      </Text>
      <ErrorNotice message={error || app.sessionError} />
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <Field
        label="Contact phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={25}
      />
      <Choices
        label="Default fulfillment"
        value={mode}
        choices={[
          { value: "pickup", label: "Shop pickup" },
          { value: "delivery", label: "Delivery" },
        ]}
        onChange={setMode}
      />
      {mode === "delivery" && (
        <>
          <Field
            label="Default delivery address"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Field
            label="Landmark (optional)"
            value={landmark}
            onChangeText={setLandmark}
          />
        </>
      )}
      <Button
        title="Save details"
        busy={busy}
        onPress={async () => {
          if (
            name.trim().length < 2 ||
            phone.trim().length < 7 ||
            (mode === "delivery" && address.trim().length < 5)
          ) {
            setError(
              "Add your name, reachable phone and delivery address if needed.",
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            await app.service.mutate("onboard", {
              name,
              phone,
              mode,
              address,
              landmark,
            });
            await app.reload();
            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {app.session?.address && (
        <Button
          title="Remove saved address"
          outline
          onPress={() =>
            Alert.alert(
              "Remove saved address?",
              "Existing order addresses remain part of the agreed order.",
              [
                { text: "Back", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await app.service.mutate("forget_address", {});
                      await app.reload();
                      setAddress("");
                      setLandmark("");
                    } catch (error) {
                      setError((error as Error).message);
                    }
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
