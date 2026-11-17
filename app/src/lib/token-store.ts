// Phone: the device token lives in the OS keychain (Keychain on iOS, Keystore-backed on Android).
import * as SecureStore from "expo-secure-store";

export const getToken = (key: string) => SecureStore.getItemAsync(key);
export const setToken = (key: string, value: string) => SecureStore.setItemAsync(key, value);
