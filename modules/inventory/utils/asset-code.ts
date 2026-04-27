const DEFAULT_ASSET_CODE_PREFIX = "AST";
const RANDOM_SUFFIX_START_INDEX = 2;
const RANDOM_SUFFIX_END_INDEX = 6;

/**
 * Generate asset code with timestamp and random suffix.
 */
export function generateAssetCode(
  prefix: string = DEFAULT_ASSET_CODE_PREFIX,
): string {
  const timestampCode = Date.now().toString(36).toUpperCase();
  const randomCode = Math.random()
    .toString(36)
    .substring(RANDOM_SUFFIX_START_INDEX, RANDOM_SUFFIX_END_INDEX)
    .toUpperCase();

  return `${prefix}-${timestampCode}${randomCode}`;
}
