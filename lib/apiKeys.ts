"use client";

export type StoredApiKeys = {
  relayApiKey: string;
};

const RELAY_API_KEY_STORAGE_KEY = "makeup_tool_relay_api_key";

const LEGACY_OPENAI_API_KEY_STORAGE_KEY = "makeup_tool_openai_api_key";
const LEGACY_OPENAI_API_KEY_SESSION_KEY = "makeup_tool_openai_api_key";
const LEGACY_BANANA_API_KEY_STORAGE_KEY = "makeup_tool_banana_api_key";
const LEGACY_GOOGLE_API_KEY_STORAGE_KEY = "makeup_tool_google_api_key";

const LEGACY_RELAY_BASE_URL_STORAGE_KEY = "makeup_tool_relay_base_url";
const LEGACY_GPT_MODEL_STORAGE_KEY = "makeup_tool_gpt_model";
const LEGACY_BANANA_MODEL_STORAGE_KEY = "makeup_tool_banana_model";
const LEGACY_OPENAI_BASE_URL_STORAGE_KEY = "makeup_tool_openai_base_url";
const LEGACY_OPENAI_MODEL_STORAGE_KEY = "makeup_tool_openai_model";
const LEGACY_BANANA_BASE_URL_STORAGE_KEY = "makeup_tool_banana_base_url";
const LEGACY_PROXY_URL_STORAGE_KEY = "makeup_tool_proxy_url";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readLegacyOpenAIKey() {
  const sessionKey = canUseSessionStorage()
    ? window.sessionStorage.getItem(LEGACY_OPENAI_API_KEY_SESSION_KEY) ?? ""
    : "";
  const localKey = window.localStorage.getItem(LEGACY_OPENAI_API_KEY_STORAGE_KEY) ?? "";
  return sessionKey || localKey;
}

function migrateLegacyConfig() {
  const currentRelayApiKey = window.localStorage.getItem(RELAY_API_KEY_STORAGE_KEY) ?? "";
  const legacyOpenAIKey = readLegacyOpenAIKey();
  const legacyBananaKey = window.localStorage.getItem(LEGACY_BANANA_API_KEY_STORAGE_KEY) ?? "";
  const legacyGoogleKey = window.localStorage.getItem(LEGACY_GOOGLE_API_KEY_STORAGE_KEY) ?? "";
  const migratedKey = legacyOpenAIKey || legacyBananaKey || legacyGoogleKey;

  if (!currentRelayApiKey && migratedKey) {
    window.localStorage.setItem(RELAY_API_KEY_STORAGE_KEY, migratedKey.trim());
  }
}

export function getStoredApiKeys(): StoredApiKeys {
  if (!canUseLocalStorage()) {
    return {
      relayApiKey: ""
    };
  }

  migrateLegacyConfig();

  return {
    relayApiKey: window.localStorage.getItem(RELAY_API_KEY_STORAGE_KEY) ?? ""
  };
}

export function saveApiKeys({ relayApiKey }: StoredApiKeys) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(RELAY_API_KEY_STORAGE_KEY, relayApiKey.trim());
}

export function clearApiKeys() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(RELAY_API_KEY_STORAGE_KEY);

  window.localStorage.removeItem(LEGACY_OPENAI_API_KEY_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_BANANA_API_KEY_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_GOOGLE_API_KEY_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_RELAY_BASE_URL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_GPT_MODEL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_BANANA_MODEL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_OPENAI_BASE_URL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_OPENAI_MODEL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_BANANA_BASE_URL_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_PROXY_URL_STORAGE_KEY);

  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(LEGACY_OPENAI_API_KEY_SESSION_KEY);
  }
}

export function hasRequiredKeys() {
  const { relayApiKey } = getStoredApiKeys();
  return relayApiKey.trim().length > 0;
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return "";
  }

  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}****${suffix}`;
}
