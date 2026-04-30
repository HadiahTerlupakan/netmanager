import { logger } from "@/lib/logger";

const DEFAULT_KEYWORD = "ONU Fiberhome AN5506";
const TOKOPEDIA_SOURCE = "tokopedia";
const SEARCH_PRODUCT_OPERATION = "SearchProductQueryV4";
const PRODUCT_FETCH_LIMIT = 10;
const GRAPHQL_URL = "https://gql.tokopedia.com/graphql/SearchProductQueryV4";
const SEARCH_QUERY = `query SearchProductQueryV4($params: String!) { ace_search_product_v4(params: $params) { data { products { id name price originalPrice ratingAverage countReview url imageUrl badges { title imageUrl } labelGroups { position title } shop { name city } } } } }`;
const TOKOPEDIA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Origin: "https://www.tokopedia.com",
  Referer: "https://www.tokopedia.com/",
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  "Sec-Ch-Ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
} as const;

type TokopediaBadge = { title: string; imageUrl: string };
type TokopediaLabelGroup = { position: string; title: string };
type TokopediaShop = { name?: string; city?: string };
type TokopediaProduct = {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  ratingAverage: string;
  countReview: number;
  url: string;
  imageUrl: string;
  badges?: TokopediaBadge[];
  labelGroups?: TokopediaLabelGroup[];
  shop?: TokopediaShop;
};

type TokopediaSearchResponse = {
  data?: {
    ace_search_product_v4?: {
      data?: {
        products?: TokopediaProduct[];
      };
    };
  };
};

export type MarketPriceItemDTO = {
  id: string;
  name: string;
  price: number;
  priceText: string;
  originalPrice: number;
  discount: number;
  rating: string;
  reviewCount: number;
  sold: string;
  badge: string;
  shopLocation?: string;
  shopName?: string;
  url: string;
  image: string;
};

export type MarketPriceResponseDTO = {
  source: string;
  keyword: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  products: MarketPriceItemDTO[];
};

function resolveKeyword(keyword?: string | null) {
  return keyword?.trim() || DEFAULT_KEYWORD;
}

function parsePrice(value?: string) {
  const digitsOnly = value?.replace(/[^\d]/g, "") || "0";
  return Number.parseInt(digitsOnly, 10) || 0;
}

function getSoldLabel(groups?: TokopediaLabelGroup[]) {
  return (
    groups?.find((group) => group.position === "product_card")?.title || ""
  );
}

function mapProductToItem(product: TokopediaProduct): MarketPriceItemDTO {
  const price = parsePrice(product.price);
  const originalPrice = parsePrice(product.originalPrice);

  return {
    ...buildProductIdentity(product),
    price,
    priceText: product.price,
    originalPrice,
    discount: getProductDiscount(price, originalPrice),
    rating: product.ratingAverage,
    reviewCount: product.countReview,
    sold: getSoldLabel(product.labelGroups),
    badge: product.badges?.[0]?.title || "",
    ...buildShopInfo(product),
  };
}

function buildProductIdentity(product: TokopediaProduct) {
  return {
    id: product.id,
    name: product.name,
    url: product.url,
    image: product.imageUrl,
  };
}

function buildShopInfo(product: TokopediaProduct) {
  return {
    shopLocation: product.shop?.city,
    shopName: product.shop?.name,
  };
}

function getProductDiscount(price: number, originalPrice: number) {
  return Math.max(originalPrice - price, 0);
}

function calculateAveragePrice(prices: number[]) {
  if (prices.length === 0) {
    return 0;
  }

  const totalPrice = prices.reduce((sum, price) => sum + price, 0);
  return Math.round(totalPrice / prices.length);
}

function buildResponse(
  keyword: string,
  products: MarketPriceItemDTO[],
): MarketPriceResponseDTO {
  const prices = products
    .map((product) => product.price)
    .filter((price) => price > 0);

  return {
    source: TOKOPEDIA_SOURCE,
    keyword,
    averagePrice: calculateAveragePrice(prices),
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    products,
  };
}

function buildSearchParams(keyword: string) {
  const encodedKeyword = encodeURIComponent(keyword);
  return (
    "device=desktop&navsource=&ob=23&page=1" +
    `&q=${encodedKeyword}` +
    `&related=true&rows=${PRODUCT_FETCH_LIMIT}` +
    "&safe_search=false&scheme=https&shipping=&source=search" +
    "&st=product&start=0&topads_bucket=true&unique_id="
  );
}

function buildSearchPayload(keyword: string) {
  return {
    operationName: SEARCH_PRODUCT_OPERATION,
    variables: {
      params: buildSearchParams(keyword),
    },
    query: SEARCH_QUERY,
  };
}

async function fetchTokopediaProducts(keyword: string) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: TOKOPEDIA_HEADERS,
    body: JSON.stringify(buildSearchPayload(keyword)),
  });

  if (!response.ok) {
    throw new Error(`Tokopedia API responded with status ${response.status}`);
  }

  const json = (await response.json()) as TokopediaSearchResponse;
  return json.data?.ace_search_product_v4?.data?.products || [];
}

export class MarketPriceRouteService {
  /** Get market price data from Tokopedia for a keyword. */
  async getMarketPrice(
    keyword?: string | null,
  ): Promise<MarketPriceResponseDTO> {
    const resolvedKeyword = resolveKeyword(keyword);

    try {
      const products = await fetchTokopediaProducts(resolvedKeyword);
      const items = products.map(mapProductToItem);
      return buildResponse(resolvedKeyword, items);
    } catch (error) {
      logger.error("Error fetching market price", error, {
        keyword: resolvedKeyword,
      });
      throw error;
    }
  }
}

let marketPriceRouteServiceInstance: MarketPriceRouteService | null = null;

/** Get singleton market price route service. */
export function getMarketPriceRouteService() {
  if (!marketPriceRouteServiceInstance) {
    marketPriceRouteServiceInstance = new MarketPriceRouteService();
  }

  return marketPriceRouteServiceInstance;
}
