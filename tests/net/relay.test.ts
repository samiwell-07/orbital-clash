/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { RoomRegistry } from '../../server/rooms';
import { attachNetRelay } from '../../server/netRelay';
import { MAX_ROOM_PEERS, NET_PATH, type ServerMsg } from '../../src/net/protocol';

describe('RoomRegistry', () => {
  it('hosts with a fresh 4-digit code and assigns increasing, never-reused peer ids', () => {
    const seq = [0, 0, 0.5];
    const reg = new RoomRegistry<string>(() => seq.shift() ?? 0.99);
    expect(reg.host('a')).toEqual({ code: '1000', peer: 0 });
    expect(reg.host('x')).toEqual({ code: '5500', peer: 0 }); // '1000' taken -> rerolled
    expect(reg.host('a')).toEqual({ error: 'Already in a room' });
    expect(reg.join('b', '1000')).toEqual({ code: '1000', peer: 1, peers: [0, 1] });
    expect(reg.join('b', '1000')).toEqual({ error: 'Already in a room' });
    expect(reg.join('c', '4321')).toEqual({ error: 'No room with code 4321' });
    expect(reg.leave('b')).toEqual({ peer: 1, notify: [{ client: 'a', peer: 0 }] });
    expect(reg.join('c', '1000')).toEqual({ code: '1000', peer: 2, peers: [0, 2] });
  });

  it('caps room size, routes targets, keeps the room after the host leaves and deletes it when empty', () => {
    const reg = new RoomRegistry<number>();
    const r = reg.host(0);
    if ('error' in r) throw new Error(r.error);
    for (let i = 1; i < MAX_ROOM_PEERS; i++) expect(reg.join(i, r.code)).not.toHaveProperty('error');
    expect(reg.join(99, r.code)).toEqual({ error: 'Room is full' });
    expect(reg.targets(1).map((m) => m.peer)).toEqual([0, 2, 3, 4, 5, 6, 7]);
    expect(reg.targets(1, 3).map((m) => m.client)).toEqual([3]);
    expect(reg.targets(1, 42)).toEqual([]);
    expect(reg.targets(99)).toEqual([]);
    reg.leave(0);
    expect(reg.roomCount).toBe(1);
    for (let i = 1; i < MAX_ROOM_PEERS; i++) reg.leave(i);
    expect(reg.roomCount).toBe(0);
    expect(reg.leave(1)).toBeNull();
  });
});

describe('net relay over websockets', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  async function startServer(): Promise<{ server: http.Server; port: number }> {
    const server = http.createServer();
    const relay = attachNetRelay(server);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    cleanup.push(() => {
      relay.close();
      server.close();
    });
    return { server, port: (server.address() as AddressInfo).port };
  }

  /** A client that queues every server message so tests can await them in order. */
  async function connect(port: number) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${NET_PATH}`);
    const queue: ServerMsg[] = [];
    const waiters: ((m: ServerMsg) => void)[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      const w = waiters.shift();
      if (w) w(m);
      else queue.push(m);
    });
    cleanup.push(() => ws.terminate());
    await new Promise((res, rej) => {
      ws.once('open', res);
      ws.once('error', rej);
    });
    return {
      ws,
      send: (m: unknown) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
      next: (): Promise<ServerMsg> => {
        const m = queue.shift();
        return m ? Promise.resolve(m) : new Promise((res) => waiters.push(res));
      },
    };
  }

  it('hosts, joins, relays messages and orders peerLeft after the leaver’s messages', async () => {
    const { port } = await startServer();
    const host = await connect(port);
    const w = await host.next();
    expect(w.t).toBe('welcome');
    if (w.t === 'welcome') for (const u of w.urls) expect(u).toMatch(new RegExp(`^http://[\\d.]+:${port}/$`));

    host.send({ t: 'msg', data: { t: 'closed' } });
    expect(await host.next()).toEqual({ t: 'error', reason: 'Not in a room' });

    host.send({ t: 'host' });
    const hosted = await host.next();
    if (hosted.t !== 'hosted') throw new Error('expected hosted');
    expect(hosted.code).toMatch(/^\d{4}$/);
    expect(hosted.peer).toBe(0);

    const a = await connect(port);
    await a.next();
    a.send({ t: 'join', code: '0000' });
    expect(await a.next()).toEqual({ t: 'error', reason: 'No room with code 0000' });
    a.send({ t: 'join', code: hosted.code });
    expect(await a.next()).toEqual({ t: 'joined', code: hosted.code, peer: 1, peers: [0, 1] });
    expect(await host.next()).toEqual({ t: 'peerJoined', peer: 1 });

    const b = await connect(port);
    await b.next();
    b.send({ t: 'join', code: hosted.code });
    expect(await b.next()).toEqual({ t: 'joined', code: hosted.code, peer: 2, peers: [0, 1, 2] });
    expect(await host.next()).toEqual({ t: 'peerJoined', peer: 2 });
    expect(await a.next()).toEqual({ t: 'peerJoined', peer: 2 });

    host.send('not json');
    expect((await host.next()).t).toBe('error');
    host.send({ t: 'bogus' });
    expect((await host.next()).t).toBe('error');
    host.send({ t: 'msg', data: null });
    expect((await host.next()).t).toBe('error');

    // Targeted to peer 2 only; then broadcast.
    host.send({ t: 'msg', to: 2, data: { t: 'hash', step: 1, hash: 7 } });
    host.send({ t: 'msg', data: { t: 'closed' } });
    expect(await b.next()).toEqual({ t: 'msg', from: 0, data: { t: 'hash', step: 1, hash: 7 } });
    expect(await b.next()).toEqual({ t: 'msg', from: 0, data: { t: 'closed' } });
    expect(await a.next()).toEqual({ t: 'msg', from: 0, data: { t: 'closed' } });

    // Leaver's last messages arrive before peerLeft.
    for (let step = 0; step < 20; step++) a.send({ t: 'msg', data: { t: 'input', step, intents: [] } });
    a.ws.close();
    for (let step = 0; step < 20; step++) {
      expect(await host.next()).toEqual({ t: 'msg', from: 1, data: { t: 'input', step, intents: [] } });
    }
    expect(await host.next()).toEqual({ t: 'peerLeft', peer: 1 });
    for (let step = 0; step < 20; step++) expect((await b.next()).t).toBe('msg');
    expect(await b.next()).toEqual({ t: 'peerLeft', peer: 1 });
  });

  it('leaves upgrades on other paths to other handlers', async () => {
    const { server, port } = await startServer();
    let seen = '';
    server.on('upgrade', (req, socket) => {
      if (req.url === NET_PATH) return;
      seen = req.url ?? '';
      socket.end('HTTP/1.1 418 Teapot\r\n\r\n');
    });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/other`);
    ws.on('error', () => {});
    const status = await new Promise<number | undefined>((res) => {
      ws.once('unexpected-response', (_req, r) => res(r.statusCode));
      ws.once('open', () => res(101));
      ws.once('close', () => res(undefined));
    });
    expect(seen).toBe('/other');
    expect(status).toBe(418);
  });
});
