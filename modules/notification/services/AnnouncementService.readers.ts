import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";
import {
  ANONYMOUS_READER_NAME,
  getAnnouncementRepositoryMethod,
  UNKNOWN_CUSTOMER_NAME,
  UNKNOWN_USER_NAME,
} from "./AnnouncementService.helpers";

/** Find announcement summary fields for stats output. */
export function findAnnouncementSummary(
  repository: IAnnouncementRepository,
  id: string,
) {
  return getAnnouncementRepositoryMethod(
    repository,
    repository.findSummaryById,
    "findSummaryById",
  )(id);
}

/** Find recent readers for one announcement. */
export function findRecentReaders(
  repository: IAnnouncementRepository,
  id: string,
  limit: number,
) {
  return getAnnouncementRepositoryMethod(
    repository,
    repository.findRecentReaders,
    "findRecentReaders",
  )(id, limit);
}

type RecentReaders = Awaited<ReturnType<typeof findRecentReaders>>;
type RecentReader = RecentReaders[number];

/** Add resolved reader names without changing the existing response shape. */
export async function attachReaderNames(
  repository: IAnnouncementRepository,
  recentReaders: RecentReaders,
) {
  const [userMap, pelangganMap] = await Promise.all([
    findUserNameMap(repository, recentReaders),
    findPelangganNameMap(repository, recentReaders),
  ]);

  return recentReaders.map((reader) => ({
    ...reader,
    readerName: resolveReaderName(reader, userMap, pelangganMap),
  }));
}

async function findUserNameMap(
  repository: IAnnouncementRepository,
  recentReaders: RecentReaders,
) {
  const userIds = recentReaders.flatMap((reader) =>
    reader.userId ? [reader.userId] : [],
  );
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findUserNames,
    "findUserNames",
  );
  const users = await finder(userIds);
  return new Map(users.map((user) => [user.id, user.name]));
}

async function findPelangganNameMap(
  repository: IAnnouncementRepository,
  recentReaders: RecentReaders,
) {
  const pelangganIds = recentReaders.flatMap((reader) =>
    reader.pelangganId ? [reader.pelangganId] : [],
  );
  if (pelangganIds.length === 0) {
    return new Map<string, string>();
  }

  const finder = getAnnouncementRepositoryMethod(
    repository,
    repository.findCustomerNames,
    "findCustomerNames",
  );
  const pelanggans = await finder(pelangganIds);
  return new Map(pelanggans.map((pelanggan) => [pelanggan.id, pelanggan.name]));
}

function resolveReaderName(
  reader: RecentReader,
  userMap: Map<string, string>,
  pelangganMap: Map<string, string>,
) {
  if (reader.userId) {
    return userMap.get(reader.userId) || UNKNOWN_USER_NAME;
  }
  if (reader.pelangganId) {
    return pelangganMap.get(reader.pelangganId) || UNKNOWN_CUSTOMER_NAME;
  }
  return ANONYMOUS_READER_NAME;
}
