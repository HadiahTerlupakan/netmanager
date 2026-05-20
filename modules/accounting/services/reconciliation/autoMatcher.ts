import { prisma } from "@/lib/prisma";
import { Money } from "../../Money";
import type { BankStatementRow } from "./csvParser";

export interface MatchCandidate {
  bankLineIndex: number;
  journalLineId: string;
  confidence: number;
}

export async function autoMatch(
  tenantId: string,
  coaId: string,
  bankRows: BankStatementRow[],
  windowDays: number = 3,
): Promise<MatchCandidate[]> {
  const matches: MatchCandidate[] = [];
  const usedJournalLineIds = new Set<string>();

  for (let i = 0; i < bankRows.length; i++) {
    const row = bankRows[i];
    const bankAmount = Money.fromString(row.amount);
    const dateFrom = new Date(row.date);
    dateFrom.setDate(dateFrom.getDate() - windowDays);
    const dateTo = new Date(row.date);
    dateTo.setDate(dateTo.getDate() + windowDays);

    const candidates = await prisma.journalLine.findMany({
      where: {
        coaId,
        entry: {
          tenantId,
          status: "POSTED",
          entryDate: { gte: dateFrom, lte: dateTo },
        },
        id: { notIn: Array.from(usedJournalLineIds) },
      },
      include: { entry: { select: { description: true } } },
    });

    let bestMatch: { journalLineId: string; confidence: number } | null = null;

    for (const candidate of candidates) {
      const candidateAmount = Money.fromString(candidate.amount.toString());
      const absBank = bankAmount.isNegative()
        ? Money.zero().subtract(bankAmount)
        : bankAmount;
      if (!absBank.equals(candidateAmount)) {
        continue;
      }

      const descSimilarity = levenshteinSimilarity(
        row.description.toLowerCase(),
        (candidate.entry?.description || "").toLowerCase(),
      );

      const confidence = 0.6 + descSimilarity * 0.4;

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { journalLineId: candidate.id, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.6) {
      matches.push({
        bankLineIndex: i,
        journalLineId: bestMatch.journalLineId,
        confidence: bestMatch.confidence,
      });
      usedJournalLineIds.add(bestMatch.journalLineId);
    }
  }

  return matches;
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}
