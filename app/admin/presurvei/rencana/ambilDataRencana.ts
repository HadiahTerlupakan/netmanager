/** Amplop sukses `apiSuccess` (`lib/api-response.ts`). */
interface AmplopData<T> {
  data: T;
}

/**
 * `GET` JSON dan kembalikan isi `data`-nya; respons non-OK dilempar sebagai
 * `Error(pesanGagal)` supaya React Query menandainya gagal.
 */
export async function ambilDataRencana<T>(
  url: string,
  pesanGagal: string,
): Promise<T> {
  const respons = await fetch(url);
  if (!respons.ok) throw new Error(pesanGagal);
  const badan = (await respons.json()) as AmplopData<T>;
  return badan.data;
}
