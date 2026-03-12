import { useEffect, useRef, useCallback, useState } from "react";

export function useNotifications(token) {
  const eventSourceRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(null);
  const [connected, setConnected] = useState(false);

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

      es.onopen = () => setConnected(true);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Dispatch to all listeners immediately
          listenersRef.current.forEach((fn) => fn(data));

          // Sound for incoming messages (when tab is open)
          if (data.type === "new_message" && data.direction === "incoming") {
            playNotificationSound();
          }
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Reconnect fast (1s) to minimize notification gaps
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

  return { subscribe, connected };
}

// ==================== WEB PUSH SUBSCRIPTION ====================

async function subscribeToPush(token) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const res = await fetch("/api/push/vapid-key");
    const { publicKey } = await res.json();
    if (!publicKey) return;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // Send subscription to backend
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

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Two-tone pop like WhatsApp
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.frequency.setValueAtTime(660, t);
    osc2.frequency.setValueAtTime(880, t + 0.08);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.setValueAtTime(0.25, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.start(t);
    osc1.stop(t + 0.08);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.2);
  } catch {}
}
