import type { StoredAuth, StoredDraft } from "./types.js";

const AUTH_KEY = "ei_auth";
const SELECTED_EVENT_KEY = "ei_selected_event";
const DRAFTS_KEY = "ei_drafts";

export async function getAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(AUTH_KEY);
  return (result[AUTH_KEY] as StoredAuth | undefined) ?? null;
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

export async function getSelectedEventId(): Promise<string | null> {
  const result = await chrome.storage.local.get(SELECTED_EVENT_KEY);
  return (result[SELECTED_EVENT_KEY] as string | undefined) ?? null;
}

export async function setSelectedEventId(eventId: string): Promise<void> {
  await chrome.storage.local.set({ [SELECTED_EVENT_KEY]: eventId });
}

export async function getDrafts(): Promise<StoredDraft[]> {
  const result = await chrome.storage.local.get(DRAFTS_KEY);
  return (result[DRAFTS_KEY] as StoredDraft[] | undefined) ?? [];
}

export async function saveDraft(draft: StoredDraft): Promise<void> {
  const drafts = await getDrafts();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    drafts[idx] = draft;
  } else {
    drafts.push(draft);
  }
  await chrome.storage.local.set({ [DRAFTS_KEY]: drafts });
}

export async function removeDraft(draftId: string): Promise<void> {
  const drafts = await getDrafts();
  await chrome.storage.local.set({ [DRAFTS_KEY]: drafts.filter((d) => d.id !== draftId) });
}

export async function getPendingDrafts(): Promise<StoredDraft[]> {
  const drafts = await getDrafts();
  return drafts.filter((d) => !d.submitted);
}
