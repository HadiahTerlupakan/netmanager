import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { ApiErrors, createHandler } from "@/lib/api";

// Headers to mimic a real browser to avoid simple bot detection
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
};

// Helper for human-like delay
const randomDelay = async (min: number = 300, max: number = 800) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise((resolve) => setTimeout(resolve, delay));
};

const GRAPHQL_URL = "https://gql.tokopedia.com/graphql/SearchProductQueryV4";

const SEARCH_QUERY = `
  query SearchProductQueryV4($params: String!) {
    ace_search_product_v4(params: $params) {
      data {
        products {
          id
          name
          price
          originalPrice
          ratingAverage
          countReview
          url
          imageUrl
          badges {
            title
            imageUrl
          }
          labelGroups {
            position
            title
          }
          shop {
            name
            city
          }
        }
      }
    }
  }
`;

interface TokopediaProduct {
  id: string;
  name: string;
  price: string;
  originalPrice: string;
  ratingAverage: string;
  countReview: number;
  url: string;
  imageUrl: string;
  badges: Array<{ title: string; imageUrl: string }>;
  labelGroups: Array<{ position: string; title: string }>;
  shop: { name: string; city: string };
}

interface MarketPriceResult {
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
  shopLocation: string;
  shopName: string;
  url: string;
  image: string;
}

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return ApiErrors.badRequest("Kata kunci wajib diisi");
  }

  try {
    const params = Object.entries({
      device: "desktop",
      navsource: "",
      ob: "23",
      page: "1",
      q: keyword,
      related: "true",
      rows: "20",
      safe_search: "false",
      scheme: "https",
      shipping: "",
      source: "search",
      st: "product",
      start: "0",
      topads_bucket: "true",
      unique_id: "3220fd80a919cd5d95aaa42075073a58",
      user_id: "0",
      variants: "",
    })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    await randomDelay(300, 800);

    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        ...TOKOPEDIA_HEADERS,
        Referer: `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent(keyword)}`,
      },
      body: JSON.stringify({
        operationName: "SearchProductQueryV4",
        variables: {
          params: params,
        },
        query: SEARCH_QUERY,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error API Tokopedia: ${response.status}`);
    }

    const json = await response.json();
    const products: TokopediaProduct[] =
      json.data?.ace_search_product_v4?.data?.products || [];

    const results: MarketPriceResult[] = products
      .map((p) => {
        const price = parseInt(p.price.replace(/[^0-9]/g, ""));
        const originalPrice = p.originalPrice
          ? parseInt(p.originalPrice.replace(/[^0-9]/g, ""))
          : 0;
        const discount =
          originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;
        const soldLabel =
          p.labelGroups?.find(
            (l) =>
              l.position === "cost_per_unit" ||
              l.title.toLowerCase().includes("terjual"),
          )?.title || "";
        const badge = p.badges?.[0]?.title || "Merchant";

        return {
          id: p.id,
          name: p.name,
          price,
          priceText: p.price,
          originalPrice,
          discount,
          rating: p.ratingAverage,
          reviewCount: p.countReview,
          sold: soldLabel.replace("Terjual ", ""),
          badge,
          shopLocation: p.shop?.city,
          shopName: p.shop?.name,
          url: p.url,
          image: p.imageUrl,
        };
      })
      .filter((p) => p.price > 0);

    const total = results.reduce((sum: number, p) => sum + p.price, 0);
    const average = results.length > 0 ? total / results.length : 0;

    return NextResponse.json({
      source: "Tokopedia",
      keyword,
      averagePrice: average,
      minPrice: Math.min(...results.map((p) => p.price)),
      maxPrice: Math.max(...results.map((p) => p.price)),
      products: results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    logger.error("Market Price API Error:", error);
    return ApiErrors.internalError(`Gagal mengambil harga pasar: ${message}`);
  }
});
