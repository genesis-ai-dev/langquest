/**
 * Bandwidth-throttling TCP proxy for local attachment load testing.
 *
 * Sits between the phone and the local backend so you can slow down or cut
 * the connection WITHOUT touching the phone's wifi (adb and Metro keep
 * working). Proxies both local services:
 *
 *   phone :54329  →  Supabase  127.0.0.1:54321   (auth, DB, storage files)
 *   phone :8009   →  PowerSync 127.0.0.1:8000    (record sync)
 *
 * Point the app at the proxy by editing .env.local (see instructions in the
 * chat / README), then control speed LIVE by typing into this terminal:
 *
 *   rate 50        limit to 50 KB/s total (both directions, shared)
 *   rate 500       limit to 500 KB/s
 *   unlimited      no limit (default)
 *   off            sever the connection (refuses new + kills active sockets)
 *   on             restore the connection
 *   status         show current setting and active connection count
 *
 * Usage:
 *   npx tsx scripts/throttle-proxy.ts [--rate <KB/s>]
 */

import * as net from 'net';
import * as readline from 'readline';

const ROUTES = [
  { listen: 54329, target: 54321, name: 'supabase' },
  { listen: 8009, target: 8000, name: 'powersync' }
];
const TICK_MS = 50;

function argRate(): number {
  const index = process.argv.indexOf('--rate');
  const value = index >= 0 ? parseInt(process.argv[index + 1] ?? '', 10) : NaN;
  return Number.isFinite(value) ? value : 0; // 0 = unlimited
}

let rateKBps = argRate();
let enabled = true;
const sockets = new Set<net.Socket>();

/**
 * Global token bucket shared by every connection and direction, so the cap
 * behaves like one physical pipe. Refilled every tick; chunks queue when
 * tokens run out.
 */
let tokens = 0;
const waiters: (() => void)[] = [];

setInterval(() => {
  if (rateKBps <= 0) return;
  tokens = Math.min(rateKBps * 1024 * (TICK_MS / 1000) * 2, tokens + rateKBps * 1024 * (TICK_MS / 1000));
  while (waiters.length > 0 && tokens > 0) waiters.shift()!();
}, TICK_MS).unref();

async function throttledWrite(dest: net.Socket, chunk: Buffer): Promise<void> {
  let offset = 0;
  while (offset < chunk.length) {
    if (rateKBps <= 0) {
      // Unlimited: flush the rest immediately.
      if (!dest.write(chunk.subarray(offset))) {
        await new Promise((r) => dest.once('drain', r));
      }
      return;
    }
    while (tokens <= 0) {
      await new Promise<void>((r) => waiters.push(r));
    }
    const allowance = Math.min(Math.floor(tokens), chunk.length - offset, 16384);
    tokens -= allowance;
    if (!dest.write(chunk.subarray(offset, offset + allowance))) {
      await new Promise((r) => dest.once('drain', r));
    }
    offset += allowance;
  }
}

function pipe(source: net.Socket, dest: net.Socket): void {
  let chain: Promise<void> = Promise.resolve();
  source.on('data', (chunk: Buffer) => {
    source.pause();
    chain = chain
      .then(() => throttledWrite(dest, chunk))
      .then(() => source.resume())
      .catch(() => source.destroy());
  });
  source.on('end', () => {
    void chain.then(() => dest.end());
  });
  source.on('error', () => dest.destroy());
}

for (const route of ROUTES) {
  const server = net.createServer((client) => {
    if (!enabled) {
      client.destroy();
      return;
    }
    const upstream = net.connect(route.target, '127.0.0.1');
    sockets.add(client);
    sockets.add(upstream);
    client.on('close', () => sockets.delete(client));
    upstream.on('close', () => sockets.delete(upstream));
    upstream.on('error', () => client.destroy());
    pipe(client, upstream);
    pipe(upstream, client);
  });
  server.listen(route.listen, '0.0.0.0', () => {
    console.log(
      `✅ ${route.name}: listening on :${route.listen} → 127.0.0.1:${route.target}`
    );
  });
}

function status(): void {
  const rate = rateKBps > 0 ? `${rateKBps} KB/s` : 'unlimited';
  const state = enabled ? 'ON' : 'OFF (connection severed)';
  console.log(`   ${state} | rate: ${rate} | active sockets: ${sockets.size}`);
}

console.log(
  '\nCommands: rate <KB/s> | unlimited | off | on | status | quit\n'
);
status();

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const [cmd, value] = line.trim().split(/\s+/);
  switch (cmd) {
    case 'rate': {
      const kb = parseInt(value ?? '', 10);
      if (!Number.isFinite(kb) || kb <= 0) {
        console.log('   usage: rate <KB/s>, e.g. rate 50');
        break;
      }
      rateKBps = kb;
      tokens = 0;
      break;
    }
    case 'unlimited':
      rateKBps = 0;
      break;
    case 'off':
      enabled = false;
      for (const socket of sockets) socket.destroy();
      break;
    case 'on':
      enabled = true;
      break;
    case 'quit':
    case 'exit':
      process.exit(0);
    // eslint-disable-next-line no-fallthrough -- process.exit never returns
    case 'status':
    case '':
      break;
    default:
      console.log(`   unknown command: ${cmd}`);
  }
  status();
});
