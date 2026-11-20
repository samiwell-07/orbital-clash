/// <reference types="node" />
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Plugin } from 'vite';
import { MAX_MESSAGE_BYTES, NET_PATH } from '../src/net/protocol';
import type { ServerMsg } from '../src/net/protocol';
import { RoomRegistry } from './rooms';

export interface NetRelay {
  close(): void;
}

/** http://<ip>:<port>/ for every non-internal IPv4 interface. */
function lanUrls(server: Server): string[] {
  const addr = server.address();
  if (!addr || typeof addr === 'string') return [];
  const urls: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      const v4 = info.family === 'IPv4' || (info.family as unknown) === 4;
      if (v4 && !info.internal) urls.push(`http://${info.address}:${addr.port}/`);
    }
  }
  return urls;
}

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

function rawSize(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

/** Mounts the room relay on `server` at NET_PATH. Other upgrade requests (e.g. Vite HMR) are left alone. */
export function attachNetRelay(server: Server): NetRelay {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const rooms = new RoomRegistry<WebSocket>();

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      return;
    }
    if (pathname !== NET_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };
  server.on('upgrade', onUpgrade);

  wss.on('connection', (ws: WebSocket) => {
    ws.on('error', () => {});
    send(ws, { t: 'welcome', urls: lanUrls(server) });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary || rawSize(data) > MAX_MESSAGE_BYTES) {
        send(ws, { t: 'error', reason: 'Bad message' });
        return;
      }
      let msg: unknown;
      try {
        msg = JSON.parse(rawToString(data));
      } catch {
        send(ws, { t: 'error', reason: 'Bad message' });
        return;
      }
      if (!isObject(msg)) {
        send(ws, { t: 'error', reason: 'Bad message' });
        return;
      }
      switch (msg.t) {
        case 'host': {
          const r = rooms.host(ws);
          if ('error' in r) send(ws, { t: 'error', reason: r.error });
          else send(ws, { t: 'hosted', code: r.code, peer: r.peer });
          return;
        }
        case 'join': {
          if (typeof msg.code !== 'string') {
            send(ws, { t: 'error', reason: 'Bad message' });
            return;
          }
          const r = rooms.join(ws, msg.code);
          if ('error' in r) {
            send(ws, { t: 'error', reason: r.error });
            return;
          }
          send(ws, { t: 'joined', code: r.code, peer: r.peer, peers: r.peers });
          for (const m of rooms.others(ws)) send(m.client, { t: 'peerJoined', peer: r.peer });
          return;
        }
        case 'msg': {
          const { data: payload, to } = msg;
          if (!isObject(payload) || typeof payload.t !== 'string' || (to !== undefined && !Number.isInteger(to))) {
            send(ws, { t: 'error', reason: 'Bad message' });
            return;
          }
          const from = rooms.peerOf(ws);
          if (from === null) {
            send(ws, { t: 'error', reason: 'Not in a room' });
            return;
          }
          const out = JSON.stringify({ t: 'msg', from, data: payload });
          for (const m of rooms.targets(ws, to as number | undefined)) {
            if (m.client.readyState === WebSocket.OPEN) m.client.send(out);
          }
          return;
        }
        default:
          send(ws, { t: 'error', reason: 'Unknown message type' });
      }
    });

    ws.on('close', () => {
      const left = rooms.leave(ws);
      if (!left) return;
      for (const m of left.notify) send(m.client, { t: 'peerLeft', peer: left.peer });
    });
  });

  return {
    close() {
      server.off('upgrade', onUpgrade);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

/** Vite plugin: serves the relay from the dev and preview servers (not in middleware mode / tests). */
export function netRelayPlugin(): Plugin {
  const mount = (httpServer: unknown): void => {
    if (!httpServer) return;
    const server = httpServer as Server;
    const relay = attachNetRelay(server);
    server.once('close', () => relay.close());
  };
  return {
    name: 'orbital-clash-net-relay',
    configureServer(s) {
      mount(s.httpServer);
    },
    configurePreviewServer(s) {
      mount(s.httpServer);
    },
  };
}
