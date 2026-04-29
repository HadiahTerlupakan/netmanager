import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";

const DEFAULT_KEYWORD = "ONU Fiberhome AN5506";
const TOKOPEDIA_SOURCE = "tokopedia";
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

type MarketPriceItem = {
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

type MarketPriceResponse = {
  source: string;
  keyword: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  products: MarketPriceItem[];
};

/** Read search keyword from query string with fallback. */
function getKeyword(request: Request & { nextUrl: URL }) {
  return request.nextUrl.searchParams.get("keyword") || DEFAULT_KEYWORD;
}

/** Convert formatted price text into an integer amount. */
function parsePrice(value?: string) {
  const digitsOnly = value?.replace(/[^\d]/g, "") || "0";
  return Number.parseInt(digitsOnly, 10) || 0;
}

/** Resolve sold label from Tokopedia label groups. */
function getSoldLabel(groups?: TokopediaLabelGroup[]) {
  return (
    groups?.find((group) => group.position === "product_card")?.title || ""
  );
}

/** Convert Tokopedia product into route response item. */
function mapProductToItem(product: TokopediaProduct): MarketPriceItem {
  const price = parsePrice(product.price);
  const originalPrice = parsePrice(product.originalPrice);
  return {
    id: product.id,
    name: product.name,
    price,
    priceText: product.price,
    originalPrice,
    discount: Math.max(originalPrice - price, 0),
    rating: product.ratingAverage,
    reviewCount: product.countReview,
    sold: getSoldLabel(product.labelGroups),
    badge: product.badges?.[0]?.title || "",
    shopLocation: product.shop?.city,
    shopName: product.shop?.name,
    url: product.url,
    image: product.imageUrl,
  };
}

/** Build aggregated response from mapped product results. */
function buildResponse(
  keyword: string,
  products: MarketPriceItem[],
): MarketPriceResponse {
  const prices = products
    .map((product) => product.price)
    .filter((price) => price > 0);
  return {
    source: TOKOPEDIA_SOURCE,
    keyword,
    averagePrice: prices.length
      ? Math.round(
          prices.reduce((sum, price) => sum + price, 0) / prices.length,
        )
      : 0,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    products,
  };
}

/** Fetch Tokopedia products for market price lookup. */
async function fetchTokopediaProducts(keyword: string) {
  const payload = {
    operationName: "SearchProductQueryV4",
    variables: {
      params: `device=desktop&navsource=&ob=23&page=1&q=${encodeURIComponent(keyword)}&related=true&rows=10&safe_search=false&scheme=https&shipping=&source=search&st=product&start=0&topads_bucket=true&unique_id=`,
    },
    query: SEARCH_QUERY,
  };
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: TOKOPEDIA_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(`Tokopedia API responded with status ${response.status}`);
  const json = (await response.json()) as TokopediaSearchResponse;
  return json.data?.ace_search_product_v4?.data?.products || [];
}

/** Handle market price lookup request. */
export const GET = createHandler({ auth: false }, async (req) => {
  const keyword = getKeyword(req);
  try {
    const products = await fetchTokopediaProducts(keyword);
    return NextResponse.json(
      buildResponse(keyword, products.map(mapProductToItem)),
    );
  } catch (error) {
    logger.error("Error fetching market price", error, { keyword });
    return ApiErrors.internalError("Gagal mengambil data harga pasar");
  }
});
