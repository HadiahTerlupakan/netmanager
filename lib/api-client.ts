/**
 * Helper functions for API calls with proper authentication
 */

/**
 * Fetch dengan credentials untuk autentikasi
 * @param url - URL endpoint
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * GET request dengan autentikasi
 * @param url - URL endpoint
 * @param options - Fetch options tambahan
 * @returns Promise<Response>
 */
export async function getWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithAuth(url, {
    method: "GET",
    ...options,
  });
}

/**
 * POST request dengan autentikasi
 * @param url - URL endpoint
 * @param data - Data body
 * @param options - Fetch options tambahan
 * @returns Promise<Response>
 */
export async function postWithAuth(
  url: string,
  data: unknown,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithAuth(url, {
    method: "POST",
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * PUT request dengan autentikasi
 * @param url - URL endpoint
 * @param data - Data body
 * @param options - Fetch options tambahan
 * @returns Promise<Response>
 */
export async function putWithAuth(
  url: string,
  data: unknown,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithAuth(url, {
    method: "PUT",
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * PATCH request dengan autentikasi
 * @param url - URL endpoint
 * @param data - Data body
 * @param options - Fetch options tambahan
 * @returns Promise<Response>
 */
export async function patchWithAuth(
  url: string,
  data: unknown,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithAuth(url, {
    method: "PATCH",
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * DELETE request dengan autentikasi
 * @param url - URL endpoint
 * @param options - Fetch options tambahan
 * @returns Promise<Response>
 */
export async function deleteWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithAuth(url, {
    method: "DELETE",
    ...options,
  });
}
