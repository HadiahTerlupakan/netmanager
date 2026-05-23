import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type Server, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccelPppCliClient } from "@/modules/network/services/accel-ppp/AccelPppCliClient";
import {
  AccelPppCliCommandError,
  AccelPppCliConnectionError,
  AccelPppCliTimeoutError,
} from "@/modules/network/domain/errors/AccelPppErrors";

const FIXTURES_DIR = join(__dirname, "fixtures");
function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

interface MockServerHandle {
  server: Server;
  port: number;
  receivedRequests: string[];
}

/**
 * Buat TCP server lokal yang berperilaku mirip accel-ppp CLI.
 * Why: integration test butuh socket beneran biar tutupan flow connect/data/end
 * benar-benar diuji, bukan cuma mock.
 */
async function startMockServer(
  handler: (socket: Socket, request: string) => void,
): Promise<MockServerHandle> {
  const handle: MockServerHandle = {
    server: createServer(),
    port: 0,
    receivedRequests: [],
  };

  handle.server.on("connection", (socket) => {
    let buffer = "";
    let handled = false;

    const tryHandle = () => {
      if (handled) return;
      // accel-ppp menutup koneksi setelah menerima command + `exit`.
      // Mock: handle segera setelah lihat token `exit\n` di stream.
      if (buffer.includes("exit\n")) {
        handled = true;
        handle.receivedRequests.push(buffer);
        handler(socket, buffer);
      }
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      tryHandle();
    });
    socket.on("end", () => {
      // Kalau client tutup duluan tanpa exit (mis. test timeout), tetap
      // catat raw buffer dan biarkan handler ambil keputusan.
      if (!handled) {
        handled = true;
        handle.receivedRequests.push(buffer);
        handler(socket, buffer);
      }
    });
  });

  await new Promise<void>((resolve) => {
    handle.server.listen(0, "127.0.0.1", () => {
      const address = handle.server.address();
      if (address && typeof address !== "string") {
        handle.port = address.port;
      }
      resolve();
    });
  });

  return handle;
}

async function stopMockServer(handle: MockServerHandle): Promise<void> {
  await new Promise<void>((resolve) => {
    handle.server.close(() => resolve());
    handle.server.unref();
  });
}

describe("AccelPppCliClient (integration with mock socket)", () => {
  let mockServer: MockServerHandle | null = null;

  beforeEach(() => {
    mockServer = null;
  });

  afterEach(async () => {
    if (mockServer) await stopMockServer(mockServer);
  });

  it("kirim password sebagai baris pertama lalu command", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("show-sessions-multi.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      password: "rahasia",
      timeoutMs: 2000,
    });

    const sessions = await client.showSessions();
    expect(sessions).toHaveLength(3);
    expect(mockServer.receivedRequests[0]).toBe(
      "rahasia\nshow sessions\nexit\n",
    );
  });

  it("tidak kirim baris password kalau password tidak diset", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("show-stat.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      timeoutMs: 2000,
    });

    const stat = await client.showStat();
    expect(stat.activeSessions).toBe(2);
    expect(mockServer.receivedRequests[0]).toBe("show stat\nexit\n");
  });

  it("treat response auth-failed sebagai AccelPppCliCommandError saat password diset", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("auth-failed.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      password: "salah",
      timeoutMs: 2000,
    });

    await expect(client.ping()).rejects.toBeInstanceOf(AccelPppCliCommandError);
  });

  it("kembalikan AccelPppCliConnectionError saat host unreachable", async () => {
    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: 1, // dijamin tidak listen
      timeoutMs: 2000,
    });

    await expect(client.ping()).rejects.toBeInstanceOf(
      AccelPppCliConnectionError,
    );
  });

  it("kembalikan AccelPppCliTimeoutError saat server tidak respon dalam batas waktu", async () => {
    mockServer = await startMockServer(() => {
      // Tidak respond dan tidak end → timeout terjadi.
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      timeoutMs: 200,
    });

    await expect(client.ping()).rejects.toBeInstanceOf(AccelPppCliTimeoutError);
  });

  it("terminateByUsername success → terminated true", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("terminate-success.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      timeoutMs: 2000,
    });

    const result = await client.terminateByUsername("budi.santoso");
    expect(result.terminated).toBe(true);
    expect(result.notFound).toBe(false);
  });

  it("terminateByUsername not-found → notFound true", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("terminate-not-found.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      timeoutMs: 2000,
    });

    const result = await client.terminateByUsername("ghost.user");
    expect(result.notFound).toBe(true);
    expect(result.terminated).toBe(false);
  });

  it("sanitize argument username untuk cegah command injection", async () => {
    mockServer = await startMockServer((socket) => {
      socket.write(loadFixture("terminate-success.txt"));
      socket.end();
    });

    const client = new AccelPppCliClient({
      host: "127.0.0.1",
      port: mockServer.port,
      timeoutMs: 2000,
    });

    await client.terminateByUsername("budi\nshow sessions");
    // newline harus dihapus → command tetap satu baris terminate
    expect(mockServer.receivedRequests[0]).toBe(
      "terminate username budishowsessions\nexit\n",
    );
  });
});
