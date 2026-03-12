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
        reconnectRef.current = setTimeout(connect, 3000);
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
