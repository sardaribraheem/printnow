import React, { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator, Platform } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useApp } from "../core/provider";
import { accessToken, apiOrigin } from "../core/client";
import { styles as s, colors } from "../theme";
import type { RootStack, SelectedFile } from "../navigation";
import { Screen, ErrorNotice, PreviewNotice, Empty } from "../components/ui";
import PrivatePdf from "../components/pdf-view";
function LocalDocument({ file }: { file: SelectedFile }) {
  return (
    <View style={s.page}>
      <View style={{ padding: 18, gap: 8 }}>
        <Text style={s.h3}>{file.name}</Text>
        <Text style={s.muted}>
          On this device · No cloud upload
          {file.pages
            ? " · " + file.pages + (file.pages === 1 ? " page" : " pages")
            : ""}
        </Text>
      </View>
      {file.mimeType === "application/pdf" ? (
        <PrivatePdf uri={file.uri} token="" onError={() => {}} />
      ) : (
        <Image
          source={{ uri: file.uri }}
          accessibilityLabel={file.name}
          style={{ flex: 1, width: "100%" }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
export function SelectedPreviewScreen() {
  const { params } = useRoute<RouteProp<RootStack, "LocalPreview">>();
  return <LocalDocument file={params.file} />;
}
export function FilePreviewScreen() {
  const { params } = useRoute<RouteProp<RootStack, "FilePreview">>();
  const { demo, demoService, session } = useApp();
  const viewerIdentity = session?.user.user_id;
  const [token, setToken] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setToken("");
    setError("");
    if (!demo && viewerIdentity)
      void accessToken()
        .then((value) => {
          if (active) setToken(value);
        })
        .catch(() => {
          if (active)
            setError("Please sign in again to view this private file.");
        });
    else if (!demo) setError("Please sign in again to view this private file.");
    return () => {
      active = false;
    };
  }, [demo, params.id, viewerIdentity]);
  if (demo) {
    const uri = demoService.fileUris.get(params.id);
    if (uri)
      return (
        <LocalDocument
          file={{
            uri,
            name: params.name,
            size: 0,
            mimeType: params.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "image/jpeg",
          }}
        />
      );
    return (
      <Screen>
        <PreviewNotice />
        <Text style={s.h2}>{params.name}</Text>
        <Empty
          title="Sample document view"
          text="This sample has no local file. Select your own PDF or image from Home to preview it on your phone."
        />
        <Text style={s.muted}>
          No selected files have been uploaded from this preview.
        </Text>
      </Screen>
    );
  }
  if (Platform.OS === "web")
    return (
      <Screen>
        <Text style={s.h2}>{params.name}</Text>
        <Text style={s.muted}>
          Open the Android app for the native document viewer.
        </Text>
      </Screen>
    );
  return (
    <View style={s.page}>
      <View style={{ padding: 18 }}>
        <Text style={s.h3}>{params.name}</Text>
        <ErrorNotice message={error} />
      </View>
      {token ? (
        <PrivatePdf
          uri={apiOrigin + "/api/mobile/v1/files/" + params.id}
          token={token}
          onError={() =>
            setError(
              "This file is unavailable or access has changed. Return to the request and try again.",
            )
          }
        />
      ) : !error ? (
        <ActivityIndicator color={colors.orange} />
      ) : null}
    </View>
  );
}
