import { useEffect, useRef } from "react";
import type { WsInMessage, WsOutMessage } from "@arcanorum/shared";
import { apiBase } from "./api";

export function useWs(onMessage: (msg: WsOutMessage) => void, token?: string | null, resumeFromWorldStateVersion?: number | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const authedTokenRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);
  const resumeFromWorldStateVersionRef = useRef(resumeFromWorldStateVersion);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    resumeFromWorldStateVersionRef.current = resumeFromWorldStateVersion;
  }, [resumeFromWorldStateVersion]);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      authedTokenRef.current = null;
      return;
    }

    const wsUrl = apiBase.replace("http", "ws") + "/ws";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const lastKnownWorldStateVersion = resumeFromWorldStateVersionRef.current;
      ws.send(JSON.stringify({
        type: "AUTH",
        token,
        ...(typeof lastKnownWorldStateVersion === "number" && Number.isFinite(lastKnownWorldStateVersion)
          ? { lastKnownWorldStateVersion: Math.max(0, Math.floor(lastKnownWorldStateVersion)) }
          : {}),
      } satisfies WsInMessage));
      authedTokenRef.current = token;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WsOutMessage;
      onMessageRef.current(message);
    };

    return () => {
      ws.close();
      authedTokenRef.current = null;
    };
  }, [token]);

  const send = (message: WsInMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !token) {
      return;
    }

    if (authedTokenRef.current !== token) {
      const lastKnownWorldStateVersion = resumeFromWorldStateVersionRef.current;
      ws.send(JSON.stringify({
        type: "AUTH",
        token,
        ...(typeof lastKnownWorldStateVersion === "number" && Number.isFinite(lastKnownWorldStateVersion)
          ? { lastKnownWorldStateVersion: Math.max(0, Math.floor(lastKnownWorldStateVersion)) }
          : {}),
      } satisfies WsInMessage));
      authedTokenRef.current = token;
    }
    ws.send(JSON.stringify(message));
  };

  return { send };
}
