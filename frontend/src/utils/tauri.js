// Tauri API utilities - conditionally loaded
export const loadTauriAPI = async () => {
  // Skip Tauri API loading in web development
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null
  }

  try {
    const { listen } = await new Function('return import("@tauri-apps/api/event")')()
    return listen
  } catch (e) {
    return null // Not in desktop environment
  }
}