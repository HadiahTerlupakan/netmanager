import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Runtime yang dipakai MEMVALIDASI harus sama dengan runtime yang dipakai
 * MENJALANKAN.
 *
 * Kejadian nyata (2026-09-21): image runner `netmanager-ci` tertinggal di
 * `node:20-bullseye` selama berbulan-bulan, sementara `package.json` menuntut
 * `>=24.0.0` dan image produksi memakai `node:24-alpine`. Jadi job `quality` —
 * lint, typecheck, dan 4136 tes — lulus di Node 20, lalu aplikasinya dikirim
 * berjalan di Node 24. Perbedaan perilaku antar versi tidak akan pernah
 * tertangkap. `npm ci` mencetak EBADENGINE tiap run, tetapi peringatan bukan
 * kegagalan sehingga tidak ada yang menindaklanjuti.
 *
 * Penyimpangan itu bertahan lama karena definisi image hidup di luar repo
 * (`/home/ubuntu/ci-image/Dockerfile` pada host Gitea) sehingga tidak pernah
 * terlihat saat review. Salinannya kini diversikan di `.gitea/ci-image/`, dan
 * tes ini yang menjaganya tetap sejalan.
 */

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/** Angka mayor dari rentang semver sederhana seperti ">=24.0.0". */
function majorFromEngineRange(range: string): number {
  const match = range.match(/(\d+)/);
  if (!match) throw new Error(`Rentang engine tidak dikenali: ${range}`);
  return Number(match[1]);
}

/** Angka mayor dari baris `FROM node:24-bookworm` atau `node:24-alpine`. */
function majorFromDockerBase(dockerfile: string): number {
  const match = dockerfile.match(/^FROM node:(\d+)[-\s]/m);
  if (!match) throw new Error("Tidak menemukan baris `FROM node:<versi>`");
  return Number(match[1]);
}

describe("versi Node runner, produksi, dan package.json sejalan", () => {
  const enginesRange = (
    JSON.parse(readProjectFile("package.json")) as {
      engines?: { node?: string };
    }
  ).engines?.node;

  it("package.json menyatakan versi Node yang dituntut", () => {
    expect(enginesRange).toBeTruthy();
  });

  it("image runner CI memakai mayor Node yang sama dengan engines", () => {
    const diminta = majorFromEngineRange(enginesRange!);
    const runner = majorFromDockerBase(
      readProjectFile(".gitea/ci-image/Dockerfile"),
    );

    expect(runner).toBe(diminta);
  });

  it("image produksi memakai mayor Node yang sama dengan engines", () => {
    const diminta = majorFromEngineRange(enginesRange!);
    const produksi = majorFromDockerBase(readProjectFile("Dockerfile"));

    expect(produksi).toBe(diminta);
  });
});
