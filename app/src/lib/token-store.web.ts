// Web demo: browsers have no keychain, so the device token is kept in localStorage.
export async function getToken(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setToken(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode: the session lasts as long as the tab
  }
}
