import { useEffect, useRef, useCallback, useState } from "react";

export function useNotifications(token) {
  const eventSourceRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Request browser notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

          // Browser notification + sound for incoming messages
          if (data.type === "new_message" && data.direction === "incoming") {
            playNotificationSound();
            showBrowserNotification(data);
          }
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 3s
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

function showBrowserNotification(data) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.hasFocus()) return; // Don't notify if tab is focused

  const title = data.contactName || data.phone || "Nova mensagem";
  const body = data.messageType !== "text"
    ? `[${data.messageType}] ${data.messageText || ""}`
    : data.messageText || "Nova mensagem";

  const notification = new Notification(title, {
    body: body.slice(0, 100),
    icon: "/favicon.ico",
    tag: `msg-${data.contactId}`,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => notification.close(), 5000);
}
