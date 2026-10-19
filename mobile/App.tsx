import "react-native-url-polyfill/auto";
import React, { useEffect } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { AppProvider, useApp } from "./src/core/provider";
import type { RootStack } from "./src/navigation";
import { colors } from "./src/theme";
import { Icon } from "./src/components/ui";
import { HomeScreen, HistoryScreen, MessagesScreen } from "./src/screens/home";
import { ComposeScreen } from "./src/screens/compose";
import { RequestScreen } from "./src/screens/request";
import { OrderScreen } from "./src/screens/order";
import {
  AccountScreen,
  AuthScreen,
  ProfileScreen,
} from "./src/screens/account";
import {
  FeedScreen,
  ProviderSetupScreen,
  ProviderSettingsScreen,
} from "./src/screens/provider";
import { NotificationsScreen } from "./src/screens/notifications";
import {
  FilePreviewScreen,
  SelectedPreviewScreen,
} from "./src/screens/file-preview";
WebBrowser.maybeCompleteAuthSession();
const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<RootStack>();
function Tabs() {
  const { providerMode } = useApp();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: colors.ink,
          fontSize: 16,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          paddingTop: 10,
          paddingBottom: 8,
          height: 78,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: "#8B948D",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 4 },
        tabBarIcon: ({ focused, color }) => (
          <Icon
            color={color}
            size={23}
            name={
              route.name === "Home"
                ? providerMode
                  ? "print-outline"
                  : focused
                    ? "home"
                    : "home-outline"
                : route.name === "Orders"
                  ? focused
                    ? "receipt"
                    : "receipt-outline"
                  : route.name === "Messages"
                    ? focused
                      ? "chatbubble-ellipses"
                      : "chatbubble-ellipses-outline"
                    : focused
                      ? "person-circle"
                      : "person-circle-outline"
            }
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={providerMode ? FeedScreen : HomeScreen}
        options={{
          headerShown: providerMode,
          title: providerMode ? "Jobs" : "Home",
          headerTitle: "PrintNow · Printer",
        }}
      />
      <Tab.Screen
        name="Orders"
        component={HistoryScreen}
        options={{ title: "Orders" }}
      />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
function Navigator() {
  const { recovering } = useApp();
  useEffect(() => {
    if (recovering && navigationRef.isReady()) navigationRef.navigate("Auth");
  }, [recovering]);
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          primary: colors.ink,
          text: colors.ink,
          card: colors.background,
          border: colors.line,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontSize: 16, fontWeight: "700" },
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen
          name="Main"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Compose"
          component={ComposeScreen}
          options={{ title: "New print" }}
        />
        <Stack.Screen
          name="Request"
          component={RequestScreen}
          options={{ title: "Print request" }}
        />
        <Stack.Screen
          name="Order"
          component={OrderScreen}
          options={{ title: "Your order" }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ title: "PrintNow" }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: "Your details" }}
        />
        <Stack.Screen
          name="ProviderSetup"
          component={ProviderSetupScreen}
          options={{ title: "Become a provider" }}
        />
        <Stack.Screen
          name="ProviderSettings"
          component={ProviderSettingsScreen}
          options={{ title: "Printer settings" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Notifications" }}
        />
        <Stack.Screen
          name="LocalPreview"
          component={SelectedPreviewScreen}
          options={{ title: "On-device preview" }}
        />
        <Stack.Screen
          name="FilePreview"
          component={FilePreviewScreen}
          options={{ title: "Private file" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
