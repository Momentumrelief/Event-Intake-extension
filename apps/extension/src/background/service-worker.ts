// Background service worker — handles offline draft sync

const API_BASE = "http://localhost:3000";
const DRAFTS_KEY = "ei_drafts";
const AUTH_KEY = "ei_auth";

interface StoredDraft {
  id: string;
  idempotencyKey: string;
  submitted: boolean;
  [key: string]: unknown;
}

interface StoredAuth {
  accessToken: string;
}

self.addEventListener("install", () => {
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener("activate", (event: Event) => {
  const e = event as ExtendableEvent;
  e.waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim());
});

// Retry unsubmitted drafts every 5 minutes
chrome.alarms.create("retry-drafts", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "retry-drafts") {
    syncPendingDrafts();
  }
});

async function syncPendingDrafts(): Promise<void> {
  const storage = await chrome.storage.local.get([DRAFTS_KEY, AUTH_KEY]);
  const drafts: StoredDraft[] = storage[DRAFTS_KEY] ?? [];
  const auth: StoredAuth | undefined = storage[AUTH_KEY];

  if (!auth) return;

  const pending = drafts.filter((d) => !d.submitted);
  if (pending.length === 0) return;

  for (const draft of pending) {
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify(draft),
      });

      if (res.ok || res.status === 200) {
        // Mark as submitted
        const updated = drafts.map((d) =>
          d.id === draft.id ? { ...d, submitted: true } : d,
        );
        await chrome.storage.local.set({ [DRAFTS_KEY]: updated });
      }
    } catch {
      // Network still offline — will retry next alarm
    }
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message: { type: string }, _sender, sendResponse) => {
  if (message.type === "SYNC_DRAFTS") {
    syncPendingDrafts().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  }
});
