export function normalizeLogoUrl(value?: string | null): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return trimmedValue;
  }

  return `/${trimmedValue}`;
}
