import { useEffect, useRef, useCallback, useState } from "react";

export function useNotifications(token) {
  const eventSourceRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  // Request notification permission + subscribe to Web Push
  useEffect(() => {
    if (!token) return;
    subscribeToPush(token);
  }, [token]);

  // Connect to SSE
  useEffect(() => {
    if (!token) return;

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/crm/events?token=${token}`);

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Skip heartbeat events
          if (data.type === "heartbeat") return;

          // Dispatch to all listeners immediately
          listenersRef.current.forEach((fn) => fn(data));

          // Sound + unread for incoming messages
          if (data.type === "new_message" && data.direction === "incoming") {
            playNotificationSound();
            setTotalUnread((prev) => prev + 1);

            // Browser notification if tab is not focused
            if (document.hidden && Notification.permission === "granted") {
              try {
                new Notification(data.contactName || data.phone || "Nova mensagem", {
                  body: data.messageText?.slice(0, 80) || `[${data.messageType}]`,
                  icon: "/icon-192.png",
                  tag: `msg-${data.contactId}`,
                  renotify: true,
                });
              } catch {}
            }
          }
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        reconnectRef.current = setTimeout(connect, 1000);
      };

      eventSourceRef.current = es;
    };

    connect();

    return () => {
      clearTimeout(reconnectRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const resetUnread = useCallback(() => setTotalUnread(0), []);

  return { subscribe, connected, totalUnread, resetUnread };
}

// ==================== WEB PUSH SUBSCRIPTION ====================

async function subscribeToPush(token) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;

    const res = await fetch("/api/push/vapid-key");
    const { publicKey } = await res.json();
    if (!publicKey) return;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription }),
    });
  } catch (err) {
    console.warn("Push subscription failed:", err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ==================== NOTIFICATION SOUND ====================

// Generate a short WAV notification sound programmatically (two-tone beep)
function generateNotificationWav() {
  const sampleRate = 22050;
  const duration = 0.25;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);

  // Two-tone: 660Hz then 880Hz with fade out
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.1 ? 660 : 880;
    const envelope = Math.max(0, 1 - (t / duration));
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

// Pre-generate the sound URL once (works in background tabs unlike AudioContext oscillators)
let _notifSoundUrl = null;
function getNotifSoundUrl() {
  if (!_notifSoundUrl) _notifSoundUrl = generateNotificationWav();
  return _notifSoundUrl;
}

function playNotificationSound() {
  try {
    const audio = new Audio(getNotifSoundUrl());
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}
