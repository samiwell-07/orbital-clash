import { NET_PATH, type ClientMsg, type GameMsg, type ServerMsg } from './protocol';
import type { NetEvent, NetRole, NetRoom, NetStatus } from './types';

export interface CreateRoomOptions {
  /** Relay address; defaults to ws(s)://<this page's host>/net. */
  url?: string;
  /** Injectable for tests / non-browser hosts. */
  WebSocketImpl?: typeof WebSocket;
}

function defaultUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET_PATH}`;
}

/** Hosts or joins an online room through the relay over one WebSocket. */
export function createRoom(mode: { host: true } | { join: string }, opts: CreateRoomOptions = {}): NetRoom {
  const role: NetRole = 'host' in mode ? 'host' : 'client';
  const Impl = opts.WebSocketImpl ?? WebSocket;
  const listeners = new Set<(e: NetEvent) => void>();
  let status: NetStatus = 'connecting';
  let code: string | null = null;
  let me = -1;
  let peers: number[] = [];
  let urls: string[] = [];
  let error: string | null = null;
  let closedByUs = false;

  const emit = (e: NetEvent): void => {
    for (const fn of [...listeners]) fn(e);
  };
  const setStatus = (s: NetStatus): void => {
    if (status === s) return;
    status = s;
    emit({ t: 'status', status: s });
  };
  const raw = (m: ClientMsg): void => {
    if (ws && ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(m));
  };

  let ws: WebSocket | null = null;
  try {
    ws = new Impl(opts.url ?? defaultUrl());
  } catch (e) {
    error = e instanceof Error ? e.message : 'Connection failed';
    status = 'closed';
    return snapshot();
  }

  ws.onopen = () => raw('host' in mode ? { t: 'host' } : { t: 'join', code: mode.join });
  ws.onmessage = (ev: MessageEvent) => {
    let m: ServerMsg;
    try {
      m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)) as ServerMsg;
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome':
        urls = Array.isArray(m.urls) ? [...m.urls] : [];
        break;
      case 'hosted':
        code = m.code;
        me = m.peer;
        peers = [m.peer];
        error = null;
        setStatus('open');
        break;
      case 'joined':
        code = m.code;
        me = m.peer;
        peers = [...m.peers].sort((a, b) => a - b);
        error = null;
        setStatus('open');
        break;
      case 'peerJoined':
        if (!peers.includes(m.peer)) peers = [...peers, m.peer].sort((a, b) => a - b);
        emit({ t: 'peerJoined', peer: m.peer });
        break;
      case 'peerLeft':
        peers = peers.filter((p) => p !== m.peer);
        emit({ t: 'peerLeft', peer: m.peer });
        break;
      case 'error':
        error = m.reason;
        if (code === null) {
          closedByUs = true;
          ws?.close();
          setStatus('closed');
        } else emit({ t: 'status', status });
        break;
      case 'msg':
        emit({ t: 'msg', from: m.from, data: m.data });
        break;
    }
  };
  const lost = (): void => {
    if (status === 'closed') return;
    if (!closedByUs) error = 'Connection lost';
    setStatus('closed');
  };
  ws.onclose = lost;
  ws.onerror = lost;

  function snapshot(): NetRoom {
    return {
      role,
      get status() {
        return status;
      },
      get code() {
        return code;
      },
      get me() {
        return me;
      },
      get peers() {
        return peers;
      },
      get urls() {
        return urls;
      },
      get error() {
        return error;
      },
      send(data: GameMsg, to?: number) {
        if (status !== 'open') return;
        raw(to === undefined ? { t: 'msg', data } : { t: 'msg', data, to });
      },
      listen(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
      close() {
        if (status === 'closed' && closedByUs) return;
        closedByUs = true;
        try {
          ws?.close();
        } catch {
          // already closed
        }
        setStatus('closed');
      },
    };
  }

  return snapshot();
}
