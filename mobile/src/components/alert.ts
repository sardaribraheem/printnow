import { Alert as NativeAlert, Platform, type AlertButton } from "react-native";
export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== "web")
      return NativeAlert.alert(title, message, buttons);
    const text = title + (message ? "\n\n" + message : "");
    if (!buttons?.length) {
      window.alert(text);
      return;
    }
    if (window.confirm(text))
      buttons.find((button) => button.style !== "cancel")?.onPress?.();
  },
};
