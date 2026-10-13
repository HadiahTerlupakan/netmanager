import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const collectSourceFiles = (directory: string): string[] => {
  const absoluteDirectory = join(process.cwd(), directory);
  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = join(absoluteDirectory, entry);
    const relativePath = join(directory, entry);

    if (statSync(absolutePath).isDirectory()) {
      return collectSourceFiles(relativePath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
};

const readFile = (filePath: string) =>
  readFileSync(join(process.cwd(), filePath), "utf8");

describe("batas modul proyek dan finance", () => {
  it("finance tidak mengimpor module proyek", () => {
    const offenders = collectSourceFiles("modules/finance").filter((filePath) =>
      /@\/modules\/proyek/.test(readFile(filePath)),
    );

    expect(offenders).toEqual([]);
  });

  it("proyek menyentuh finance hanya lewat public-queries", () => {
    const offenders = collectSourceFiles("modules/proyek").filter((filePath) =>
      /@\/modules\/finance(?!\/public-queries)/.test(readFile(filePath)),
    );

    expect(offenders).toEqual([]);
  });

  it("tidak ada sisa pintu RAB di finance maupun endpoint lama", () => {
    // modules/proyek dikecualikan: ia satu-satunya pemilik sah pintu
    // @/modules/finance/public-queries (aturan kedua di atas yang menjaganya).
    const productionFiles = [
      ...collectSourceFiles("app"),
      ...collectSourceFiles("modules").filter(
        (filePath) => !filePath.startsWith(join("modules", "proyek")),
      ),
      ...collectSourceFiles("lib"),
      ...collectSourceFiles("components"),
    ];

    const staleGateImports = productionFiles.filter((filePath) =>
      /@\/modules\/finance\/(public-queries|validation)/.test(
        readFile(filePath),
      ),
    );
    const staleEndpoints = productionFiles.filter((filePath) =>
      /finance\/rab-projects/.test(readFile(filePath)),
    );

    expect({ staleGateImports, staleEndpoints }).toEqual({
      staleGateImports: [],
      staleEndpoints: [],
    });
  });
});
