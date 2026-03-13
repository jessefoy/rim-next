"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Alert {
  id: string;
  type: string;
  message: string;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

interface AlertsResponse {
  count: number;
  alerts: Alert[];
}

export default function AlertStrip() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/account/alerts");
      if (!res.ok) return;
      const json: AlertsResponse = await res.json();
      setData(json);
    } catch {
      // silently ignore — alerts are non-critical
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markRead = async (id: string) => {
    await fetch("/api/account/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setData((prev) =>
      prev
        ? { ...prev, count: Math.max(0, prev.count - 1), alerts: prev.alerts.filter((a) => a.id !== id) }
        : prev
    );
  };

  const markAllRead = async () => {
    await fetch("/api/account/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setData({ count: 0, alerts: [] });
    setDismissed(true);
  };

  if (!data || data.count === 0 || dismissed) return null;

  return (
    <div className="alert-strip">
      <div className="alert-strip__header">
        <span className="alert-strip__label">
          <span className="alert-strip__badge">{data.count}</span>
          {data.count === 1 ? "alert" : "alerts"}
        </span>
        <button className="alert-strip__mark-all" onClick={markAllRead}>
          Mark all read
        </button>
      </div>
      <ul className="alert-strip__list">
        {data.alerts.map((alert) => (
          <li key={alert.id} className="alert-strip__item">
            {alert.linkUrl ? (
              <Link
                href={alert.linkUrl}
                className="alert-strip__message alert-strip__message--link"
              >
                {alert.message}
              </Link>
            ) : (
              <span className="alert-strip__message">{alert.message}</span>
            )}
            <button
              className="alert-strip__dismiss"
              onClick={() => markRead(alert.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
