export type DestinationAnalysis = {
  destination: string;
  tripDays: number;
  seasonalClimate: string;
  weather: {
    temperatureC: number;
    feelsLikeC?: number;
    humidity: string;
    humidityPercent?: number;
    rainProbability: number;
    precipitationMm?: number;
    windKph: number;
    condition: string;
    cloudCoverPercent?: number;
    highC?: number;
    lowC?: number;
    uvIndex?: number;
    sunrise?: string | null;
    sunset?: string | null;
    locationName?: string;
    adminArea?: string;
    country?: string;
    timezone?: string;
    forecastStartDate?: string | null;
    forecastEndDate?: string | null;
    forecast?: {
      date: string;
      highC: number | null;
      lowC: number | null;
      rainProbability: number | null;
      uvIndex: number | null;
      condition: string;
    }[];
    source?: string;
    isLive?: boolean;
  };
  fashionProfile: Record<string, number>;
  popularColors: string[];
  recommendedItems: string[];
  avoidItems: string[];
  culturalNotes: string[];
  activities: string[];
  nightlife: string[];
  socialSignals: string[];
  clothingSuitability: { label: string; score: number; reason: string }[];
  trendConfidence: number;
  danceCulture: boolean;
  heroImage: string;
};

export type WardrobeItem = {
  id: number;
  imagePath: string;
  imageUrl?: string | null;
  name: string;
  category: string;
  color: string;
  colorHex: string;
  material: string;
  pattern: string;
  style: string;
  season: string;
  breathable: boolean;
  formality: string;
  createdAt: string;
};

export type OutfitResponse = {
  destination: string;
  gender?: "women" | "men";
  ownedItemCount: number;
  outfits: {
    name: string;
    items: (WardrobeItem & { slot: string; matchScore: number })[];
    matchScore: number;
    whyItWorks: string;
    styleNotes?: string[];
    pairings?: { itemA: string; itemB: string; reason: string }[];
  }[];
  missingItems: string[];
  shoppingRecommendations: {
    item: string;
    note: string;
    products: { merchant: string; name: string; priceRange: string; ratingEstimate: number; url: string }[];
  }[];
};

export type PackingList = {
  destination: string;
  gender?: "women" | "men";
  tripDays: number;
  clothing: string[];
  accessories: string[];
  weatherReady?: string[];
  toiletries?: string[];
  tech?: string[];
  documents: string[];
  localPrep: string[];
};

export type DancePlan = {
  destination: string;
  enabled: boolean;
  message: string;
  tutorial: { count: number; name: string; feedbackCue: string }[];
  recommendedModel: string;
};

export type ReelStudio = {
  destination: string;
  sourcePolicy: string;
  hashtags: string[];
  platforms: { name: string; url: string }[];
  audioIdeas: {
    title: string;
    mood: string;
    query: string;
    links: { platform: string; url: string }[];
  }[];
  contentIdeas: {
    title: string;
    prompt: string;
    caption: string;
  }[];
};

export type InspirationResponse = {
  destination: string;
  gender?: "women" | "men";
  query: string;
  source: string;
  socialPolicy: string;
  items: InspirationItem[];
  pinterestBoards?: PinterestBoard[];
  categories?: {
    id: string;
    title: string;
    subtitle: string;
    query: string;
    pinterestUrl?: string;
    items: InspirationItem[];
  }[];
};

export type PinterestBoard = {
  title: string;
  subtitle: string;
  query: string;
  url: string;
};

export type InspirationItem = {
    id: string;
    imageUrl: string;
    title: string;
    photographer: string | null;
    sourceUrl: string | null;
    tags: string[];
};

export type DetectedLocation = {
  resolved: boolean;
  latitude: number;
  longitude: number;
  label: string;
  shortLabel: string;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  countryCode: string;
  postcode: string | null;
  areaParts: string[];
  mapUrl: string;
  provider: string;
  attribution: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

async function responseError(response: Response, label: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  const detail = payload?.error ? `: ${payload.error}` : ` (${response.status})`;
  return new Error(`${label}${detail}`);
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw await responseError(response, path);
  }
  return response.json() as Promise<T>;
}

export async function checkApiHealth() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw await responseError(response, "/api/health");
  }
  return response.json() as Promise<{ service: string; status: string }>;
}

export function analyzeDestination(destination: string, tripDays: number, startDate?: string, endDate?: string) {
  return postJson<DestinationAnalysis>("/api/destination/analyze", { destination, tripDays, startDate, endDate });
}

export function generateOutfits(destination: string, tripDays: number, startDate?: string, endDate?: string, gender = "women") {
  return postJson<OutfitResponse>("/api/outfits", { destination, tripDays, startDate, endDate, gender });
}

export function generatePackingList(destination: string, tripDays: number, startDate?: string, endDate?: string, gender = "women") {
  return postJson<PackingList>("/api/packing-list", { destination, tripDays, startDate, endDate, gender });
}

export function reverseGeocode(latitude: number, longitude: number) {
  return postJson<DetectedLocation>("/api/location/reverse", { latitude, longitude });
}

export async function detectApproximateLocation(): Promise<DetectedLocation> {
  const response = await fetch("https://ipapi.co/json/");
  if (!response.ok) {
    throw new Error(`Approximate location failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    city?: string;
    region?: string;
    country_name?: string;
    country_code?: string;
    postal?: string;
    latitude?: number;
    longitude?: number;
  };
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
    throw new Error("Approximate location did not return coordinates.");
  }

  const parts = [data.city, data.region, data.country_name].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  );
  const label = parts.join(", ") || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;

  return {
    resolved: Boolean(parts.length),
    latitude: data.latitude,
    longitude: data.longitude,
    label,
    shortLabel: label,
    city: data.city ?? null,
    district: null,
    state: data.region ?? null,
    country: data.country_name ?? null,
    countryCode: data.country_code ?? "",
    postcode: data.postal ?? null,
    areaParts: parts,
    mapUrl: `https://www.openstreetmap.org/?mlat=${data.latitude}&mlon=${data.longitude}#map=10/${data.latitude}/${data.longitude}`,
    provider: "IP approximate location",
    attribution: "Approximate area from ipapi.co"
  };
}

export async function fetchWardrobe(seed = true) {
  const response = await fetch(`${API_BASE}/api/wardrobe?seed=${seed ? "true" : "false"}`);
  if (!response.ok) {
    throw await responseError(response, "/api/wardrobe");
  }
  return response.json() as Promise<{ items: WardrobeItem[] }>;
}

export async function clearWardrobe() {
  const response = await fetch(`${API_BASE}/api/wardrobe`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response, "/api/wardrobe");
  }
  return response.json() as Promise<{ items: WardrobeItem[] }>;
}

export async function deleteWardrobeItem(id: number) {
  const response = await fetch(`${API_BASE}/api/wardrobe/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response, `/api/wardrobe/${id}`);
  }
  return response.json() as Promise<{ items: WardrobeItem[] }>;
}

export async function fetchDancePlan(destination: string) {
  const response = await fetch(`${API_BASE}/api/dance-plan?destination=${encodeURIComponent(destination)}`);
  if (!response.ok) {
    throw await responseError(response, "/api/dance-plan");
  }
  return response.json() as Promise<DancePlan>;
}

export async function fetchReelStudio(destination: string, gender = "women") {
  const response = await fetch(`${API_BASE}/api/reel-studio?destination=${encodeURIComponent(destination)}&gender=${encodeURIComponent(gender)}`);
  if (!response.ok) {
    throw await responseError(response, "/api/reel-studio");
  }
  return response.json() as Promise<ReelStudio>;
}

export async function fetchInspiration(destination: string, gender = "women") {
  const response = await fetch(`${API_BASE}/api/inspiration?destination=${encodeURIComponent(destination)}&gender=${encodeURIComponent(gender)}`);
  if (!response.ok) {
    throw await responseError(response, "/api/inspiration");
  }
  return response.json() as Promise<InspirationResponse>;
}

export function wardrobeImageUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

export async function uploadWardrobeImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_BASE}/api/wardrobe/upload`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw await responseError(response, "/api/wardrobe/upload");
  }
  return response.json() as Promise<{ item: WardrobeItem }>;
}

export async function updateWardrobeItem(id: number, updates: { category: string }) {
  const response = await fetch(`${API_BASE}/api/wardrobe/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    throw await responseError(response, `/api/wardrobe/${id}`);
  }
  return response.json() as Promise<{ item: WardrobeItem }>;
}
