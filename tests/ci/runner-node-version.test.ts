import { describe, expect, it } from "vitest";

import { readBuildWorkflow, readProjectFile } from "../helpers/deploy-sources";

/**
 * Runtime yang dipakai MEMVALIDASI harus sama dengan runtime yang dipakai
 * MENJALANKAN.
 *
 * Kejadian nyata (2026-09-21): image runner Gitea `netmanager-ci` tertinggal
 * di `node:20-bullseye` selama berbulan-bulan, sementara `package.json`
 * menuntut `>=24.0.0` dan image produksi memakai `node:24-alpine`. Jadi job
 * `quality` — lint, typecheck, dan 4136 tes — lulus di Node 20, lalu
 * aplikasinya dikirim berjalan di Node 24. `npm ci` mencetak EBADENGINE tiap
 * run, tetapi peringatan bukan kegagalan sehingga tidak ada yang
 * menindaklanjuti.
 *
 * Runner Gitea sudah pensiun. Validasi kini berjalan di GitHub Actions, dan
 * versi Node-nya ditentukan `actions/setup-node` di tiap job — itulah yang
 * dijaga sejalan di sini.
 */

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

  it("setiap setup-node di workflow GitHub memakai mayor Node yang sama dengan engines", () => {
    const workflow = readBuildWorkflow();
    const jumlahSetupNode = workflow.match(/uses: actions\/setup-node@/g)?.length ?? 0;
    const versi = [...workflow.matchAll(/^\s+node-version: ["']?(\d+)/gm)].map(
      (match) => Number(match[1]),
    );

    // Setiap setup-node harus menyebut versinya sendiri; tanpa itu runner
    // memakai Node bawaan image ubuntu yang tidak dijaga siapa pun.
    expect(jumlahSetupNode).toBeGreaterThan(0);
    expect(versi).toHaveLength(jumlahSetupNode);
    expect(new Set(versi)).toEqual(new Set([majorFromEngineRange(enginesRange!)]));
  });

  it("image produksi memakai mayor Node yang sama dengan engines", () => {
    const diminta = majorFromEngineRange(enginesRange!);
    const produksi = majorFromDockerBase(readProjectFile("Dockerfile"));

    expect(produksi).toBe(diminta);
  });
});
