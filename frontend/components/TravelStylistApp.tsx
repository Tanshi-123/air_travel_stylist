"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Backpack,
  Camera,
  CloudRain,
  CloudSun,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Film,
  Headphones,
  ImageIcon,
  MapPin,
  Music2,
  Palette,
  Plus,
  RefreshCcw,
  ScanLine,
  Sparkles,
  Shirt,
  ShoppingBag,
  Play,
  Shuffle,
  Sun,
  ThermometerSun,
  Trash2,
  Upload,
  Wind,
  X
} from "lucide-react";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeDestination,
  checkApiHealth,
  clearWardrobe,
  deleteWardrobeItem,
  DestinationAnalysis,
  DancePlan,
  fetchDancePlan,
  fetchInspiration,
  fetchReelStudio,
  fetchWardrobe,
  generateOutfits,
  generatePackingList,
  OutfitResponse,
  PackingList,
  InspirationItem,
  InspirationResponse,
  PinterestBoard,
  ReelStudio,
  updateWardrobeItem,
  uploadWardrobeImage,
  WardrobeItem,
  wardrobeImageUrl
} from "@/lib/api";
import { TripStartPage } from "@/components/TripStartPage";
import { WelcomePage } from "@/components/WelcomePage";

type GuideView = "style" | "trends" | "travel" | "reels";

const TRIP_STORAGE_KEY = "travel-stylist:last-trip";
const WARDROBE_CATEGORIES = [
  "Shirt",
  "T-shirt",
  "Topwear",
  "Shorts",
  "Jeans",
  "Trousers",
  "Skirt",
  "Dress",
  "Sneakers",
  "Sandals",
  "Hat",
  "Scarf",
  "Jewelry",
  "Bag",
  "Belt",
  "Watch",
  "Sunglasses",
  "Jacket",
  "Blazer",
  "Loafers",
];

const COMPLETE_OUTFIT_VALUE = "Complete Outfit";
const PAIRING_OPTIONS = [COMPLETE_OUTFIT_VALUE, ...WARDROBE_CATEGORIES];

const WARDROBE_SLOT_GROUPS = [
  { label: "Tops", categories: ["Shirt", "T-shirt", "Topwear", "Blazer", "Jacket"] },
  { label: "Bottoms", categories: ["Shorts", "Jeans", "Trousers", "Skirt"] },
  { label: "One-piece", categories: ["Dress"] },
  { label: "Shoes", categories: ["Sneakers", "Sandals", "Loafers"] },
  { label: "Extras", categories: ["Hat", "Scarf", "Jewelry", "Bag", "Belt", "Watch", "Sunglasses"] },
];

const CATEGORY_SLOT: Record<string, "top" | "bottom" | "onepiece" | "footwear" | "accessory" | "piece"> = {
  Shirt: "top",
  "T-shirt": "top",
  Topwear: "top",
  Jacket: "top",
  Blazer: "top",
  Shorts: "bottom",
  Jeans: "bottom",
  Trousers: "bottom",
  Skirt: "bottom",
  Dress: "onepiece",
  Sneakers: "footwear",
  Sandals: "footwear",
  Loafers: "footwear",
  Hat: "accessory",
  Scarf: "accessory",
  Jewelry: "accessory",
  Bag: "accessory",
  Belt: "accessory",
  Watch: "accessory",
  Sunglasses: "accessory",
};

const NEUTRAL_COLORS = new Set(["Black", "White", "Cream", "Beige", "Ivory", "Charcoal", "Navy", "Denim Blue", "Brown", "Neutral"]);

function todayIso() {
  return localIsoDate(new Date());
}

function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function localIsoDate(date: Date) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

async function prepareWardrobeUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded."));
    };
    img.src = url;
  });

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) return file;
  if (blob.size >= file.size && file.size < 3_800_000) return file;
  return new File([blob], `${safeUploadName(file.name)}-upload.jpg`, { type: "image/jpeg" });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image preview could not be created."));
    reader.readAsDataURL(file);
  });
}

function safeUploadName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48) || "wardrobe";
}

function mergeWardrobeItems(current: WardrobeItem[], incoming: WardrobeItem[]) {
  const byId = new Map<number, WardrobeItem>();
  [...current, ...incoming].forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values()).sort((first, second) => {
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function recategorizeWardrobeItem(item: WardrobeItem, category: string): WardrobeItem {
  const material = materialForCategory(category, item.color);
  const breathable = ["Linen", "Cotton", "Canvas"].includes(material);
  return {
    ...item,
    category,
    material,
    breathable,
    style: styleForCategory(category),
    season: breathable ? "Summer" : "All-season",
    formality: ["Shirt", "Dress", "Blazer", "Loafers", "Topwear", "Jewelry", "Watch", "Bag", "Belt"].includes(category)
      ? "Smart"
      : "Casual",
    name: `${item.color} ${material} ${category}`,
  };
}

function materialForCategory(category: string, color: string) {
  if (["Shirt", "T-shirt", "Shorts", "Topwear", "Dress"].includes(category)) {
    return ["White", "Beige", "Sky Blue", "Cream"].includes(color) ? "Linen" : "Cotton";
  }
  if (["Jeans", "Skirt"].includes(category) && ["Denim Blue", "Charcoal", "Black"].includes(color)) return "Denim";
  if (category === "Sneakers") return "Canvas";
  if (["Sandals", "Loafers", "Bag", "Belt"].includes(category)) return "Leather";
  if (["Jewelry", "Watch"].includes(category)) return "Metal";
  if (category === "Sunglasses") return "Acetate";
  return "Mixed";
}

function styleForCategory(category: string) {
  if (["Sandals", "Shorts", "Hat", "Sunglasses"].includes(category)) return "Beachwear";
  if (["Shirt", "Dress", "Blazer", "Loafers", "Topwear", "Jewelry", "Watch", "Bag", "Belt"].includes(category)) {
    return "Smart Casual";
  }
  if (["Sneakers", "Jeans", "T-shirt", "Skirt"].includes(category)) return "Streetwear";
  return "Casual";
}

export function TravelStylistApp({
  initialScreen = "welcome"
}: {
  initialScreen?: "welcome" | "setup";
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<"welcome" | "setup" | "dashboard">(initialScreen);
  const [destination, setDestination] = useState("Goa");
  const [tripDays, setTripDays] = useState(4);
  const [startDate, setStartDate] = useState(() => todayIso());
  const [endDate, setEndDate] = useState(() => addDaysIso(todayIso(), 3));
  const [gender, setGender] = useState<"women" | "men">("women");
  const [analysis, setAnalysis] = useState<DestinationAnalysis | null>(null);
  const [outfits, setOutfits] = useState<OutfitResponse | null>(null);
  const [packing, setPacking] = useState<PackingList | null>(null);
  const [dance, setDance] = useState<DancePlan | null>(null);
  const [inspiration, setInspiration] = useState<InspirationResponse | null>(null);
  const [reels, setReels] = useState<ReelStudio | null>(null);
  const [latestUploaded, setLatestUploaded] = useState<WardrobeItem | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [showOutfitAnalysis, setShowOutfitAnalysis] = useState(false);
  const [pairingGoal, setPairingGoal] = useState(COMPLETE_OUTFIT_VALUE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("Current location");
  const [travelStyle, setTravelStyle] = useState("style");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeView, setActiveView] = useState<GuideView>("style");

  useEffect(() => {
    try {
      const savedTrip = window.localStorage.getItem(TRIP_STORAGE_KEY);
      if (!savedTrip) return;
      const parsed = JSON.parse(savedTrip) as {
        destination?: string;
        tripDays?: number;
        origin?: string;
        travelStyle?: string;
        startDate?: string;
        endDate?: string;
        gender?: "women" | "men";
      };
      if (parsed.destination) setDestination(parsed.destination);
      if (parsed.tripDays) setTripDays(parsed.tripDays);
      if (parsed.origin) setOrigin(parsed.origin);
      if (parsed.travelStyle) setTravelStyle(parsed.travelStyle);
      if (parsed.startDate) setStartDate(parsed.startDate);
      if (parsed.endDate) setEndDate(parsed.endDate);
      if (parsed.gender) setGender(parsed.gender);
    } catch {
      // Ignore malformed local data and keep the default starter trip.
    }
  }, []);

  function persistTrip(
    nextDestination: string,
    nextTripDays: number,
    nextOrigin: string,
    nextTravelStyle: string,
    nextStartDate: string,
    nextEndDate: string,
    nextGender: "women" | "men"
  ) {
    try {
      window.localStorage.setItem(
        TRIP_STORAGE_KEY,
        JSON.stringify({
          destination: nextDestination,
          tripDays: nextTripDays,
          origin: nextOrigin,
          travelStyle: nextTravelStyle,
          startDate: nextStartDate,
          endDate: nextEndDate,
          gender: nextGender
        })
      );
    } catch {
      // Planning should still work if storage is unavailable.
    }
  }

  async function runPlanningFlow(
    nextDestination = destination,
    nextTripDays = tripDays,
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextGender = gender,
    preferredWardrobeItemId?: number,
    keepLocalWardrobe = false
  ) {
    setLoading(true);
    setError("");
    try {
      const [analysisResult, outfitResult, packingResult, danceResult, inspirationResult, reelResult, wardrobeResult] = await Promise.allSettled([
        analyzeDestination(nextDestination, nextTripDays, nextStartDate, nextEndDate),
        generateOutfits(nextDestination, nextTripDays, nextStartDate, nextEndDate, nextGender),
        generatePackingList(nextDestination, nextTripDays, nextStartDate, nextEndDate, nextGender),
        fetchDancePlan(nextDestination),
        fetchInspiration(nextDestination, nextGender),
        fetchReelStudio(nextDestination, nextGender),
        fetchWardrobe(false)
      ]);

      const failedSections: string[] = [];
      if (analysisResult.status === "fulfilled") {
        setAnalysis(analysisResult.value);
      } else {
        failedSections.push("destination");
      }
      if (outfitResult.status === "fulfilled") {
        setOutfits(outfitResult.value);
      } else {
        failedSections.push("outfits");
      }
      if (packingResult.status === "fulfilled") {
        setPacking(packingResult.value);
      } else {
        failedSections.push("packing");
      }
      if (danceResult.status === "fulfilled") {
        setDance(danceResult.value);
      } else {
        failedSections.push("dance");
      }
      if (inspirationResult.status === "fulfilled") {
        setInspiration(inspirationResult.value);
      } else {
        failedSections.push("inspiration");
      }
      if (reelResult.status === "fulfilled") {
        setReels(reelResult.value);
      } else {
        failedSections.push("reels");
      }
      if (wardrobeResult.status === "fulfilled") {
        if (!keepLocalWardrobe) {
          setWardrobeItems(wardrobeResult.value.items);
        }
        setLatestUploaded((current) => {
          const sourceItems = keepLocalWardrobe ? wardrobeItems : wardrobeResult.value.items;
          const preferred = preferredWardrobeItemId
            ? sourceItems.find((item) => item.id === preferredWardrobeItemId)
            : null;
          if (preferred) return preferred;
          if (current?.id && sourceItems.some((item) => item.id === current.id)) {
            return sourceItems.find((item) => item.id === current.id) ?? current;
          }
          return current ?? sourceItems.find((item) => item.imageUrl) ?? null;
        });
      } else {
        failedSections.push("wardrobe");
      }

      if (failedSections.length) {
        await checkApiHealth();
        setError(`${failedSections.join(", ")} data could not refresh. Flask is running, so tap refresh once more or check that route in the backend logs.`);
      }
    } catch (err) {
      setError("Start the Flask API on port 5000, then refresh the plan.");
    } finally {
      setLoading(false);
    }
  }

  async function startTrip(
    nextDestination: string,
    nextTripDays: number,
    nextOrigin: string,
    nextTravelStyle: string,
    nextStartDate: string,
    nextEndDate: string,
    nextGender: "women" | "men"
  ) {
    setDestination(nextDestination);
    setTripDays(nextTripDays);
    setOrigin(nextOrigin);
    setTravelStyle(nextTravelStyle);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setGender(nextGender);
    setWardrobeItems([]);
    setLatestUploaded(null);
    setOutfits(null);
    setShowOutfitAnalysis(false);
    persistTrip(nextDestination, nextTripDays, nextOrigin, nextTravelStyle, nextStartDate, nextEndDate, nextGender);
    setActiveView("style");
    setScreen("dashboard");
    try {
      await clearWardrobe();
    } catch {
      // If clearing fails, the next planning call will still surface the API error.
    }
    await runPlanningFlow(nextDestination, nextTripDays, nextStartDate, nextEndDate, nextGender);
  }

  async function processWardrobeFiles(files: File[]) {
    if (!files.length) return;
    setLoading(true);
    setError("");
    try {
      const uploadedItems: WardrobeItem[] = [];
      for (const file of files) {
        const uploadableFile = await prepareWardrobeUpload(file);
        const previewUrl = await fileToDataUrl(uploadableFile);
        const result = await uploadWardrobeImage(uploadableFile);
        uploadedItems.push({ ...result.item, imageUrl: previewUrl });
      }
      const latestItem = uploadedItems[uploadedItems.length - 1] ?? null;
      setWardrobeItems((current) => mergeWardrobeItems(current, uploadedItems));
      setLatestUploaded(latestItem);
      setShowOutfitAnalysis(false);
      await runPlanningFlow(destination, tripDays, startDate, endDate, gender, latestItem?.id, true);
    } catch (err) {
      setError("The image upload failed. Try a smaller photo or upload again after the backend redeploy finishes.");
    } finally {
      setLoading(false);
    }
  }

  async function processWardrobeFile(file: File) {
    await processWardrobeFiles([file]);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    await processWardrobeFiles(files);
    event.target.value = "";
  }

  async function handleWardrobeCategoryChange(item: WardrobeItem, category: string) {
    setLoading(true);
    setError("");
    const localUpdated = recategorizeWardrobeItem(item, category);
    setWardrobeItems((current) => current.map((candidate) => (candidate.id === item.id ? localUpdated : candidate)));
    setLatestUploaded((current) => (current?.id === item.id ? localUpdated : current));
    setShowOutfitAnalysis(false);
    try {
      const result = await updateWardrobeItem(item.id, { category });
      const serverUpdated = { ...result.item, imageUrl: item.imageUrl };
      setWardrobeItems((current) => current.map((candidate) => (candidate.id === item.id ? serverUpdated : candidate)));
      setLatestUploaded((current) => (current?.id === item.id ? serverUpdated : current));
    } catch {
      setError("Saved the category locally. The deployed backend may need a moment to sync.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWardrobeDelete(item: WardrobeItem) {
    setLoading(true);
    setError("");
    const remainingItems = wardrobeItems.filter((candidate) => candidate.id !== item.id);
    setWardrobeItems(remainingItems);
    setLatestUploaded((current) => (current?.id === item.id ? remainingItems[0] ?? null : current));
    setShowOutfitAnalysis(false);
    try {
      await deleteWardrobeItem(item.id);
    } catch {
      // Vercel may recycle temporary upload storage between requests; the local session delete still succeeded.
    } finally {
      setLoading(false);
    }
  }

  async function analyzeUploadedOutfits() {
    setShowOutfitAnalysis(true);
    await runPlanningFlow(destination, tripDays, startDate, endDate, gender, latestUploaded?.id, true);
  }

  if (screen === "welcome") {
    return <WelcomePage onExplore={() => router.push("/plan")} />;
  }

  if (screen === "setup") {
    return (
      <TripStartPage
        initialDestination={destination}
        initialOrigin={origin}
        initialTripDays={tripDays}
        initialTravelStyle={travelStyle}
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialGender={gender}
        loading={loading}
        onBack={() => router.push("/")}
        onStart={startTrip}
      />
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="dashboard-hero relative h-[250px] overflow-hidden rounded-[8px] bg-[#173239] text-white shadow-soft sm:h-[286px]">
        <img
          src={analysis?.heroImage ?? "/images/travel-planner-hero.png"}
          alt={`${analysis?.destination ?? destination} destination`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,35,39,0.9),rgba(13,35,39,0.48)_55%,rgba(13,35,39,0.12))]" />
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(120deg,rgba(255,255,255,0.16)_0_1px,transparent_1px_18px)]" />
        <div className="relative flex h-full flex-col justify-between p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setScreen("setup")}
              className="flex items-center gap-2 rounded-full bg-black/22 px-3 py-2 text-sm font-semibold backdrop-blur-md transition hover:bg-black/32"
            >
              <ArrowLeft size={17} />
              Edit trip
            </button>
            <button
              type="button"
              onClick={() => void runPlanningFlow()}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/22 backdrop-blur-md transition hover:bg-black/32"
              aria-label="Refresh destination data"
            >
              <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/68">
              <MapPin size={14} />
              {analysis?.weather.locationName ?? analysis?.destination ?? destination}
              {analysis?.weather.country ? `, ${analysis.weather.country}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
              <h1 className="text-3xl font-semibold sm:text-5xl">{analysis?.destination ?? destination}</h1>
              <p className="pb-1 text-sm font-medium text-white/72">
                {startDate} to {endDate} / <span className="capitalize">{gender}</span>
              </p>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/76">
              {analysis?.seasonalClimate ?? "Reading the destination weather and local style."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-2 rounded-full border border-white/18 bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <Sparkles size={14} />
                Vibe check {analysis ? `${analysis.trendConfidence}%` : "loading"}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-white/18 bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <CloudSun size={14} />
                Weather: destination
              </span>
              <span className="flex items-center gap-2 rounded-full border border-white/18 bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <Shirt size={14} />
                {wardrobeItems.length} wardrobe scans
              </span>
              <span className="flex items-center gap-2 rounded-full border border-white/18 bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <Shuffle size={14} />
                Pack panic: low
              </span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-center gap-2 rounded-[8px] border border-coral/30 bg-white p-3 text-sm font-medium text-coral">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : null}

      <GuideSwitcher activeView={activeView} onChange={setActiveView} />

      {activeView === "style" ? (
        <>
          <WeatherStrip analysis={analysis} />

          <section className="grid items-start gap-4 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
            <div className="grid gap-4">
              <WardrobeAction
                analysis={analysis}
                latestUploaded={latestUploaded}
              wardrobeItems={wardrobeItems}
              pairingGoal={pairingGoal}
              loading={loading}
              onUpload={handleUpload}
              onCamera={() => setCameraOpen(true)}
              onSelectItem={setLatestUploaded}
              onPairingGoalChange={setPairingGoal}
              onChangeCategory={(item, category) => void handleWardrobeCategoryChange(item, category)}
              onDeleteItem={(item) => void handleWardrobeDelete(item)}
              onAnalyzeOutfits={() => void analyzeUploadedOutfits()}
            />

              <section className="glass-panel grid gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Palette size={18} className="text-reef" />
                    <h2 className="font-semibold">Colors that fit the place</h2>
                  </div>
                  <ColorPalette colors={analysis?.popularColors ?? []} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <AdviceList title="Wear" items={analysis?.recommendedItems.slice(0, 5) ?? []} />
                  <AdviceList title="Skip for now" items={analysis?.avoidItems.slice(0, 4) ?? []} warning />
                </div>
              </section>
            </div>

            <div>
              <SectionHeading eyebrow="Your result" title="Styled for this trip" icon={<Shirt size={18} />} />
              <OutfitsPanel
                analysis={analysis}
                featuredItem={latestUploaded ?? wardrobeItems.find((item) => item.imageUrl) ?? null}
                wardrobeItems={wardrobeItems}
                outfits={outfits}
                pairingGoal={pairingGoal}
                showAnalysis={showOutfitAnalysis}
                onSelectItem={setLatestUploaded}
              />
            </div>
          </section>
        </>
      ) : null}

      {activeView === "trends" ? (
        <section className="pb-10">
          <SectionHeading eyebrow="Trend gallery" title="Outfit ideas and local references" icon={<ImageIcon size={18} />} />
          <InspirationFeed inspiration={inspiration} destination={destination} gender={gender} />

          <div className="mt-6">
            <SectionHeading eyebrow="Destination intelligence" title="Trends and cultural fit" icon={<CloudSun size={18} />} />
            <TrendsPanel analysis={analysis} />
          </div>
        </section>
      ) : null}

      {activeView === "travel" ? (
        <section className="pb-10">
          <SectionHeading eyebrow="Travel ready" title="Packing and experiences" icon={<Backpack size={18} />} />
          <PackingPanel packing={packing} />

          <div className="mt-6">
            <SectionHeading eyebrow="Wardrobe gaps" title="What you may still need" icon={<ShoppingBag size={18} />} />
            <ShopPanel outfits={outfits} />
          </div>

          {dance?.enabled ? (
            <div className="mt-6">
              <SectionHeading eyebrow="After dark" title="Dance and nightlife prep" icon={<Music2 size={18} />} />
              <DancePanel dance={dance} />
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "reels" ? (
        <section className="pb-10">
          <SectionHeading eyebrow="Reel Studio" title="Destination hashtags and creator links" icon={<Film size={18} />} />
          <ReelStudioPanel reels={reels} />
        </section>
      ) : null}

      {cameraOpen ? (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onCapture={async (file) => {
            setCameraOpen(false);
            await processWardrobeFile(file);
          }}
        />
      ) : null}
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  icon
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-reef/10 text-reef">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-reef">{eyebrow}</p>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
    </div>
  );
}

function GuideSwitcher({
  activeView,
  onChange
}: {
  activeView: GuideView;
  onChange: (view: GuideView) => void;
}) {
  const views: { id: GuideView; label: string; detail: string; Icon: typeof Shirt }[] = [
    { id: "style", label: "Style board", detail: "Weather, wardrobe, outfits", Icon: Shirt },
    { id: "trends", label: "Trends", detail: "Outfits and local photos", Icon: ImageIcon },
    { id: "travel", label: "Travel kit", detail: "Packing, shopping, dance", Icon: Backpack },
    { id: "reels", label: "Reels", detail: "Hashtags, audio, creator links", Icon: Film }
  ];

  return (
    <section className="glass-panel grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4">
      {views.map(({ id, label, detail, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`group relative flex min-h-[78px] items-center gap-3 overflow-hidden rounded-[8px] border px-3 text-left transition ${
            activeView === id
              ? "border-white/18 bg-[linear-gradient(135deg,#182025,#24464b)] text-white shadow-[0_14px_40px_rgba(24,32,37,0.2)]"
              : "border-white/54 bg-white/58 text-ink hover:-translate-y-0.5 hover:bg-white/88 hover:shadow-[0_14px_32px_rgba(24,32,37,0.08)]"
          }`}
        >
          {activeView === id ? <span className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-saffron" /> : null}
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${activeView === id ? "bg-white/14" : "bg-reef/10 text-reef group-hover:bg-reef group-hover:text-white"}`}>
            <Icon size={19} />
          </span>
          <span>
            <span className="block text-sm font-bold">{label}</span>
            <span className={`mt-1 block text-xs ${activeView === id ? "text-white/58" : "text-ink/46"}`}>{detail}</span>
          </span>
        </button>
      ))}
    </section>
  );
}

function WeatherStrip({ analysis }: { analysis: DestinationAnalysis | null }) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-ink/8 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        <WeatherMetric
          icon={<ThermometerSun size={18} />}
          label="Temperature"
          value={analysis ? `${analysis.weather.temperatureC} C` : "--"}
          detail={analysis?.weather.highC ? `${analysis.weather.lowC} / ${analysis.weather.highC} C` : undefined}
        />
        <WeatherMetric
          icon={<CloudSun size={18} />}
          label={analysis?.weather.condition ?? "Weather"}
          value={analysis?.weather.feelsLikeC ? `Feels ${analysis.weather.feelsLikeC} C` : "--"}
          detail={analysis?.weather.isLive ? "Live global weather" : "Destination profile"}
        />
        <WeatherMetric
          icon={<Droplets size={18} />}
          label="Humidity"
          value={analysis?.weather.humidityPercent !== undefined ? `${analysis.weather.humidityPercent}%` : analysis?.weather.humidity ?? "--"}
          detail={analysis?.weather.humidity}
        />
        <WeatherMetric
          icon={<CloudRain size={18} />}
          label="Rain chance"
          value={analysis ? `${analysis.weather.rainProbability}%` : "--"}
          detail={analysis?.weather.precipitationMm !== undefined ? `${analysis.weather.precipitationMm} mm now` : undefined}
        />
        <WeatherMetric
          icon={<Wind size={18} />}
          label="Wind"
          value={analysis ? `${analysis.weather.windKph} km/h` : "--"}
          detail={analysis?.weather.cloudCoverPercent !== undefined ? `${analysis.weather.cloudCoverPercent}% cloud` : undefined}
        />
        <WeatherMetric
          icon={<Sun size={18} />}
          label="UV index"
          value={analysis?.weather.uvIndex !== undefined ? `${analysis.weather.uvIndex}` : "--"}
          detail={analysis?.weather.source ?? "Weather source"}
        />
      </div>
    </section>
  );
}

function CameraCaptureModal({
  onClose,
  onCapture
}: {
  onClose: () => void;
  onCapture: (file: File) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "blocked" | "error">("starting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraMessage, setCameraMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      setCameraState("starting");
      setCameraMessage("");
      try {
        if (!window.isSecureContext) {
          setCameraMessage("Live camera needs localhost or HTTPS. Open this app from http://localhost:3000.");
          setCameraState("error");
          return;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const cameraRequests: MediaStreamConstraints[] = [
          {
            video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false
          },
          { video: true, audio: false }
        ];
        let stream: MediaStream | null = null;
        let lastError: unknown = null;
        for (const constraints of cameraRequests) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (!stream) throw lastError;
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            const video = videoRef.current;
            if (!video || video.readyState >= 1) {
              resolve();
              return;
            }
            video.onloadedmetadata = () => resolve();
            window.setTimeout(() => resolve(), 1800);
          });
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState("ready");
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setCameraMessage(error instanceof Error ? error.message : "The browser did not return a camera stream.");
        setCameraState(name === "NotAllowedError" || name === "PermissionDeniedError" ? "blocked" : "error");
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
    } else {
      void startCamera();
    }

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    await onCapture(new File([blob], `wardrobe-camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b1f]/78 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[8px] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
        <div className="flex items-start justify-between gap-4 border-b border-ink/8 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-reef">Wardrobe camera</p>
            <h2 className="mt-1 text-xl font-semibold">Place one garment in frame</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-paper text-ink/64"
            aria-label="Close camera"
          >
            <X size={17} />
          </button>
        </div>

        <div className="relative aspect-square bg-[#17282c]">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
          />
          {cameraState !== "ready" ? (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-white">
              <div>
                <Camera size={36} className="mx-auto text-white/76" />
                <p className="mt-4 font-semibold">
                  {cameraState === "starting"
                    ? "Starting camera..."
                    : cameraState === "blocked"
                      ? "Camera permission is blocked"
                      : "Camera is unavailable"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {cameraState === "blocked"
                    ? "Allow Camera in the site controls beside localhost:3000, reload, and try again. You can also use Gallery."
                    : cameraMessage || "Use the Gallery button on the wardrobe panel to upload a photo instead."}
                </p>
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-8 rounded-[8px] border-2 border-dashed border-white/62" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={() => setFacingMode((mode) => (mode === "environment" ? "user" : "environment"))}
            className="h-11 rounded-[8px] bg-paper px-4 text-sm font-bold text-ink/64"
          >
            Flip camera
          </button>
          <label className="flex h-11 cursor-pointer items-center rounded-[8px] bg-paper px-4 text-sm font-bold text-ink/64">
            Camera picker
            <input
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void onCapture(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void captureFrame()}
            disabled={cameraState !== "ready"}
            className="flex h-12 items-center gap-2 rounded-[8px] bg-coral px-6 text-sm font-bold text-white disabled:opacity-45"
          >
            <ScanLine size={18} />
            Capture and analyze
          </button>
        </div>
      </div>
    </div>
  );
}

function WeatherMetric({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="weather-metric min-h-[118px] p-4">
      <div className="flex items-center gap-2 text-reef">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/48">{label}</p>
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-ink/46">{detail}</p> : null}
    </div>
  );
}

function WardrobeAction({
  analysis,
  latestUploaded,
  wardrobeItems,
  pairingGoal,
  loading,
  onUpload,
  onCamera,
  onSelectItem,
  onPairingGoalChange,
  onChangeCategory,
  onDeleteItem,
  onAnalyzeOutfits,
}: {
  analysis: DestinationAnalysis | null;
  latestUploaded: WardrobeItem | null;
  wardrobeItems: WardrobeItem[];
  pairingGoal: string;
  loading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCamera: () => void;
  onSelectItem: (item: WardrobeItem) => void;
  onPairingGoalChange: (goal: string) => void;
  onChangeCategory: (item: WardrobeItem, category: string) => void;
  onDeleteItem: (item: WardrobeItem) => void;
  onAnalyzeOutfits: () => void;
}) {
  const featuredItem = latestUploaded ?? wardrobeItems.find((item) => item.imageUrl) ?? null;
  const imageUrl = wardrobeImageUrl(featuredItem?.imageUrl);
  const visibleWardrobe = wardrobeItems.filter((item) => item.imageUrl).slice(0, 10);
  const slotCounts = WARDROBE_SLOT_GROUPS.map((group) => ({
    ...group,
    count: wardrobeItems.filter((item) => group.categories.includes(item.category)).length
  }));
  const featuredTags = featuredItem
    ? [featuredItem.style, featuredItem.season, featuredItem.formality, featuredItem.breathable ? "Breathable" : "Structured"]
        .map((tag) => String(tag ?? "").trim())
        .filter(Boolean)
    : [];

  return (
    <article className="glass-panel wardrobe-lab overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/54 bg-white/42 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-coral">Action 01</p>
          <h2 className="mt-1 text-xl font-semibold">AI fashion assistant</h2>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Upload one anchor item, choose what to pair it with, or compare uploaded options for {analysis?.destination ?? "your trip"}.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-reef/10 px-3 py-1 text-xs font-bold text-reef">
            <Sparkles size={13} />
            Color theory + travel styling
          </div>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral/12 text-coral">
          <ScanLine size={20} />
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
        <div className="wardrobe-photo-frame relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[8px] bg-[#edf1ed]">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={featuredItem?.name ?? "Uploaded wardrobe item"} className="absolute inset-0 h-full w-full object-cover" />
              {featuredItem ? (
                <button
                  type="button"
                  onClick={() => onDeleteItem(featuredItem)}
                  disabled={loading}
                  className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/52 text-white backdrop-blur-md transition hover:bg-coral disabled:opacity-50"
                  aria-label="Delete uploaded wardrobe photo"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </>
          ) : (
            <div className="px-5 text-center">
              <Camera size={34} className="mx-auto text-reef" />
              <p className="mt-3 text-sm font-semibold">Take a clear garment photo</p>
              <p className="mt-1 text-xs leading-5 text-ink/48">Use a plain background and natural light.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {featuredItem ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-reef">Latest analysis</p>
                  <h3 className="mt-1 font-semibold">{featuredItem.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteItem(featuredItem)}
                  disabled={loading}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/10 text-coral transition hover:bg-coral hover:text-white disabled:opacity-50"
                  aria-label="Delete selected wardrobe item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="mt-1 text-sm text-ink/55">{featuredItem.color} {featuredItem.material} {featuredItem.category}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/38">This item is</span>
                  <select
                    value={featuredItem.category}
                    onChange={(event) => onChangeCategory(featuredItem, event.target.value)}
                    disabled={loading}
                    className="h-10 w-full rounded-[8px] border border-ink/10 bg-white px-3 text-sm font-bold text-ink outline-none transition focus:border-reef disabled:opacity-60"
                  >
                    {WARDROBE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/38">I want to pair it with</span>
                  <select
                    value={pairingGoal}
                    onChange={(event) => onPairingGoalChange(event.target.value)}
                    disabled={loading}
                    className="h-10 w-full rounded-[8px] border border-ink/10 bg-white px-3 text-sm font-bold text-ink outline-none transition focus:border-reef disabled:opacity-60"
                  >
                    {PAIRING_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {featuredTags.map(
                  (tag) => (
                    <span key={tag} className="rounded-full bg-paper px-3 py-1.5 text-ink/64">{tag}</span>
                  )
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-reef">Ready for the anchor item</p>
              <h3 className="mt-1 font-semibold">Upload a kurti, shirt, jeans, shoes, or accessory to begin.</h3>
            </div>
          )}

          {visibleWardrobe.length ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/42">Uploaded options</p>
                <span className="rounded-full bg-reef/10 px-2.5 py-1 text-xs font-bold text-reef">{wardrobeItems.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {visibleWardrobe.map((item) => {
                  const thumb = wardrobeImageUrl(item.imageUrl);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className={`relative aspect-square overflow-hidden rounded-[8px] bg-paper ring-offset-2 transition ${
                        featuredItem?.id === item.id ? "ring-2 ring-reef" : "hover:ring-2 hover:ring-reef/30"
                      }`}
                      title={`${item.name}: ${item.color} ${item.category}`}
                    >
                      {thumb ? <img src={thumb} alt={item.name} className="h-full w-full object-cover" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-[8px] border border-ink/6 bg-white/76 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/42">Wardrobe slots</p>
              <span className="text-xs font-bold text-coral">compare by category</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {slotCounts.map((slot) => (
                <div
                  key={slot.label}
                  className={`rounded-[8px] px-2 py-2 text-center ${
                    slot.count ? "bg-reef/10 text-reef" : "bg-paper text-ink/36"
                  }`}
                >
                  <p className="text-sm font-black">{slot.count}</p>
                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.08em]">{slot.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <button
              type="button"
              onClick={onCamera}
              disabled={loading}
              className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-ink px-3 text-sm font-bold text-white transition hover:bg-[#26343a] disabled:opacity-60"
            >
              <Camera size={17} />
              Camera
            </button>
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-reef px-3 text-sm font-bold text-white transition hover:bg-[#0b7c77]">
              <Upload size={17} />
              Gallery
              <input className="hidden" type="file" accept="image/*" multiple onChange={onUpload} disabled={loading} />
            </label>
          </div>

          <button
            type="button"
            onClick={onAnalyzeOutfits}
            disabled={loading || wardrobeItems.length < 2}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-coral px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(232,111,92,0.24)] transition hover:bg-[#d96151] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Shirt size={17} />
            Compare uploaded options
          </button>
          {wardrobeItems.length === 1 ? (
            <p className="mt-2 text-center text-xs font-semibold text-ink/42">Add options like blue, grey, and black jeans to compare them against the anchor item.</p>
          ) : null}

        </div>
      </div>
    </article>
  );
}

type WardrobeMatch = {
  item: WardrobeItem;
  score: number;
  reason: string;
};

function FashionAssistantResult({
  group,
  featuredItem,
  matches,
  idealSuggestions,
  completeLook,
  destination,
  onSelectItem
}: {
  group: PairingGroup;
  featuredItem: WardrobeItem;
  matches: WardrobeMatch[];
  idealSuggestions: StyleSuggestion[];
  completeLook: StyleSuggestion[];
  destination: string;
  onSelectItem: (item: WardrobeItem) => void;
}) {
  const isCompleteOutfit = group.value === COMPLETE_OUTFIT_VALUE;

  return (
    <div className="mt-3 rounded-[8px] border border-reef/12 bg-reef/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-reef">
          <CheckCircle2 size={13} />
          {isCompleteOutfit ? "Complete outfit plan" : `Best ${group.label}`}
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink/48">
          {isCompleteOutfit ? `${completeLook.length} pieces` : `${matches.length} uploaded`}
        </span>
      </div>

      <p className="mb-2 rounded-[8px] bg-white/78 px-3 py-2 text-xs leading-5 text-ink/58">
        Anchor: <strong>{featuredItem.color} {featuredItem.category}</strong>. {wardrobePairAdvice(featuredItem, group.label, destination)}
      </p>

      {isCompleteOutfit ? (
        <div className="grid gap-2">
          {completeLook.map((suggestion) => (
            <StyleSuggestionCard key={suggestion.title} suggestion={suggestion} />
          ))}
        </div>
      ) : matches.length ? (
        <div className="grid gap-2">
          {matches.map(({ item, score, reason }, index) => {
            const imageUrl = wardrobeImageUrl(item.imageUrl);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[8px] bg-white/82 p-2 text-left shadow-sm transition hover:bg-white"
              >
                <span className="relative h-11 w-11 overflow-hidden rounded-[8px] bg-paper">
                  {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    {index === 0 ? "Best match: " : ""}{item.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink/52">{reason}</span>
                </span>
                <span className="rounded-full bg-reef/10 px-2 py-1 text-xs font-bold text-reef">{score}%</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="rounded-[8px] bg-white/72 px-3 py-2 text-xs leading-5 text-ink/54">
            No uploaded {group.label.toLowerCase()} candidates yet. Upload {exampleOptionsForGroup(group.label)} and this section will rank them.
          </p>
          {idealSuggestions.map((suggestion) => (
            <StyleSuggestionCard key={suggestion.title} suggestion={suggestion} />
          ))}
        </div>
      )}
    </div>
  );
}

type StyleSuggestion = {
  title: string;
  subtitle: string;
  reason: string;
  swatch: string;
  imageUrl?: string;
  imageAlt?: string;
};

function StyleSuggestionCard({ suggestion }: { suggestion: StyleSuggestion }) {
  return (
    <div className="grid gap-4 rounded-[8px] bg-white/86 p-3 shadow-sm sm:grid-cols-[132px_1fr]">
      <span className="relative h-36 overflow-hidden rounded-[8px] border border-ink/8 bg-paper sm:h-32">
        {suggestion.imageUrl ? (
          <img
            src={suggestion.imageUrl}
            alt={suggestion.imageAlt ?? suggestion.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="block h-full w-full" style={{ backgroundColor: suggestion.swatch }} />
        )}
        <span className="absolute bottom-2 left-2 h-5 w-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: suggestion.swatch }} />
      </span>
      <span>
        <span className="block text-sm font-bold">{suggestion.title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-ink/52">{suggestion.subtitle}</span>
        <span className="mt-1 block text-xs leading-5 text-ink/55">{suggestion.reason}</span>
      </span>
    </div>
  );
}

function withVisualReference(suggestion: Omit<StyleSuggestion, "imageUrl" | "imageAlt">, category: string): StyleSuggestion {
  const reference = accessoryReferenceFor(category, suggestion.title);
  return {
    ...suggestion,
    imageUrl: reference.imageUrl,
    imageAlt: reference.alt,
  };
}

function accessoryReferenceFor(category: string, title: string) {
  const text = `${category} ${title}`.toLowerCase();
  const color = referenceColorForText(text);
  const kind = referenceKindForText(text);
  const query = imageQueryForReference(kind, color.label, title);
  return {
    imageUrl: `https://source.unsplash.com/720x720/?${encodeURIComponent(query)}`,
    alt: `${color.label} ${kind} fashion reference`,
  };
}

function imageQueryForReference(kind: string, color: string, title: string) {
  const categoryQueries: Record<string, string> = {
    sunglasses: "fashion sunglasses product editorial",
    watch: "stylish wrist watch fashion product",
    blazer: "modern blazer outfit fashion editorial",
    jacket: "fashion jacket outfit editorial",
    shorts: "tailored shorts fashion outfit",
    skirt: "fashion skirt outfit editorial",
    sneakers: "clean sneakers fashion product",
    sandals: "fashion sandals product",
    bag: "handbag fashion product editorial",
    belt: "leather belt fashion product",
    jewelry: "minimal jewelry fashion product",
    scarf: "silk scarf fashion outfit accessory",
    bottom: "tailored trousers fashion outfit",
    dress: "fashion dress outfit editorial",
    top: "fashion top outfit editorial",
  };
  return `${color} ${title} ${categoryQueries[kind] ?? "fashion accessory product"}`;
}

function referenceColorForText(text: string) {
  const colors = [
    { keys: ["cream", "ivory"], label: "Cream", hex: "#eee4cd" },
    { keys: ["white"], label: "White", hex: "#f6f4ee" },
    { keys: ["denim", "blue"], label: "Denim Blue", hex: "#3a608c" },
    { keys: ["pink"], label: "Pink", hex: "#d67796" },
    { keys: ["black"], label: "Black", hex: "#18191d" },
    { keys: ["charcoal", "grey", "gray"], label: "Charcoal", hex: "#55585a" },
    { keys: ["tan"], label: "Tan", hex: "#b98555" },
    { keys: ["brown"], label: "Brown", hex: "#754c31" },
    { keys: ["olive"], label: "Olive", hex: "#6a7e4c" },
    { keys: ["gold"], label: "Gold", hex: "#d4af37" },
    { keys: ["silver"], label: "Silver", hex: "#c8ccd2" },
  ];
  return colors.find((color) => color.keys.some((key) => text.includes(key))) ?? { label: "Neutral", hex: "#d8cfc0" };
}

function referenceKindForText(text: string) {
  if (text.includes("sunglasses")) return "sunglasses";
  if (text.includes("watch")) return "watch";
  if (text.includes("blazer")) return "blazer";
  if (text.includes("shorts")) return "shorts";
  if (text.includes("skirt")) return "skirt";
  if (text.includes("scarf")) return "scarf";
  if (text.includes("sneaker") || text.includes("shoe")) return "sneakers";
  if (text.includes("sandal") || text.includes("flat")) return "sandals";
  if (text.includes("bag")) return "bag";
  if (text.includes("belt")) return "belt";
  if (text.includes("jewelry") || text.includes("hoop") || text.includes("bracelet") || text.includes("pendant")) return "jewelry";
  if (text.includes("jacket") || text.includes("blazer")) return "jacket";
  if (text.includes("jeans") || text.includes("trouser") || text.includes("pants")) return "bottom";
  if (text.includes("dress")) return "dress";
  return "top";
}

function referenceSvgDataUrl(kind: string, color: string, label: string) {
  const darkText = ["#18191d", "#3a608c", "#55585a", "#754c31", "#6a7e4c"].includes(color) ? "#ffffff" : "#182b2f";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fbfaf6"/>
          <stop offset="1" stop-color="#e8f0ed"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#10292e" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="420" height="420" rx="34" fill="url(#bg)"/>
      ${referenceShapeSvg(kind, color)}
      <rect x="32" y="326" width="356" height="54" rx="18" fill="rgba(255,255,255,.78)"/>
      <circle cx="64" cy="353" r="16" fill="${color}" stroke="#fff" stroke-width="4"/>
      <text x="92" y="347" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#182b2f">${escapeSvg(label)}</text>
      <text x="92" y="368" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#5b6b6f">${escapeSvg(kind)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function referenceShapeSvg(kind: string, color: string) {
  if (kind === "blazer") {
    return `<g filter="url(#shadow)"><path d="M136 96l48-22h52l48 22 34 212h-83l-25-146-25 146h-83l34-212z" fill="${color}"/><path d="M184 76l26 78 26-78M210 154v152M170 126l40 48 40-48" fill="none" stroke="rgba(255,255,255,.58)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (kind === "jacket") {
    return `<g filter="url(#shadow)"><path d="M142 104l42-22h52l42 22 38 56-37 24v114H141V184l-37-24 38-56z" fill="${color}"/><path d="M184 82l26 58 26-58M210 140v158M159 126l-24 46M261 126l24 46" fill="none" stroke="rgba(255,255,255,.58)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (kind === "shorts") {
    return `<g filter="url(#shadow)"><path d="M128 126h164l26 168h-80l-28-82-28 82h-80l26-168z" fill="${color}"/><path d="M128 158h164M210 132v80" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (kind === "skirt") {
    return `<g filter="url(#shadow)"><path d="M146 112h128l54 196H92l54-196z" fill="${color}"/><path d="M146 144h128M178 124l-28 170M242 124l28 170" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (kind === "sneakers") {
    return `<g filter="url(#shadow)"><path d="M88 220c54 8 88-22 128-8 42 15 62 48 116 51 19 1 30 13 27 28H96c-26 0-35-42-8-71z" fill="${color}"/><path d="M124 238h80M146 216l24 38M178 214l24 38" stroke="rgba(255,255,255,.62)" stroke-width="9" stroke-linecap="round"/><path d="M90 290h268" stroke="#182b2f" stroke-opacity=".16" stroke-width="12"/></g>`;
  }
  if (kind === "sandals") {
    return `<g filter="url(#shadow)"><path d="M132 118c48 32 84 101 80 199-1 24-18 38-41 32-54-14-76-112-64-184 4-25 10-41 25-47zM268 118c-48 32-84 101-80 199 1 24 18 38 41 32 54-14 76-112 64-184-4-25-10-41-25-47z" fill="${color}"/><path d="M139 168c22 28 47 45 68 57M281 168c-22 28-47 45-68 57" stroke="rgba(255,255,255,.64)" stroke-width="10" stroke-linecap="round"/></g>`;
  }
  if (kind === "bag") {
    return `<g filter="url(#shadow)"><rect x="112" y="150" width="196" height="154" rx="28" fill="${color}"/><path d="M160 158c0-47 100-47 100 0" fill="none" stroke="#182b2f" stroke-opacity=".28" stroke-width="16" stroke-linecap="round"/><circle cx="166" cy="190" r="8" fill="rgba(255,255,255,.65)"/><circle cx="254" cy="190" r="8" fill="rgba(255,255,255,.65)"/></g>`;
  }
  if (kind === "jewelry") {
    return `<g filter="url(#shadow)" fill="none" stroke="${color}" stroke-width="18"><circle cx="166" cy="174" r="52"/><circle cx="254" cy="174" r="52"/><path d="M142 270c40 30 96 30 136 0" stroke-linecap="round"/></g>`;
  }
  if (kind === "watch") {
    return `<g filter="url(#shadow)"><rect x="176" y="72" width="68" height="276" rx="28" fill="${color}"/><circle cx="210" cy="210" r="70" fill="#fbfaf6" stroke="${color}" stroke-width="18"/><path d="M210 174v42l30 20" stroke="#182b2f" stroke-width="10" stroke-linecap="round"/></g>`;
  }
  if (kind === "belt") {
    return `<g filter="url(#shadow)"><rect x="70" y="188" width="280" height="54" rx="20" fill="${color}"/><rect x="248" y="176" width="76" height="78" rx="15" fill="none" stroke="#d4af37" stroke-width="14"/><circle cx="112" cy="215" r="8" fill="rgba(255,255,255,.62)"/></g>`;
  }
  if (kind === "bottom") {
    return `<g filter="url(#shadow)"><path d="M158 84h104l24 238h-64l-12-134-20 134h-64l32-238z" fill="${color}"/><path d="M158 124h104M210 92v70" stroke="rgba(255,255,255,.5)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (kind === "dress") {
    return `<g filter="url(#shadow)"><path d="M176 82h68l28 72-20 28 48 140H120l48-140-20-28 28-72z" fill="${color}"/><path d="M176 82l34 72 34-72" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  return `<g filter="url(#shadow)"><path d="M154 94l38-20h36l38 20 48 54-38 34v126H144V182l-38-34 48-54z" fill="${color}"/><path d="M192 74l18 44 18-44" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round"/></g>`;
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] ?? char));
}

type PairingGroup = {
  label: string;
  value: string;
  categories: string[];
};

function pairingGroupFromGoal(goal: string): PairingGroup {
  if (goal === COMPLETE_OUTFIT_VALUE) {
    return { label: COMPLETE_OUTFIT_VALUE, value: COMPLETE_OUTFIT_VALUE, categories: [] };
  }
  return { label: goal, value: goal, categories: [goal] };
}

function exampleOptionsForGroup(label: string) {
  const examples: Record<string, string> = {
    Jeans: "options like blue jeans, grey jeans, and black jeans",
    Jacket: "options like cream jacket, denim jacket, and black jacket",
    Blazer: "options like cream blazer, charcoal blazer, and black blazer",
    Sneakers: "options like white sneakers, black sneakers, and tan sneakers",
    Sandals: "options like tan sandals, black sandals, and metallic flats",
    Bag: "options like cream bag, tan bag, and black bag",
    Sunglasses: "options like brown tinted sunglasses, black sunglasses, and gold-frame sunglasses",
    Jewelry: "options like gold hoops, silver pendant, and bracelet stack",
    Watch: "options like gold watch, silver watch, and black strap watch",
    Belt: "options like brown belt, black belt, and tan belt",
  };
  return examples[label] ?? `different ${label.toLowerCase()} options`;
}

function idealPairingSuggestions(
  base: WardrobeItem,
  group: PairingGroup,
  destination: string
): StyleSuggestion[] {
  if (group.value === COMPLETE_OUTFIT_VALUE) return completeOutfitFormula(base, destination);

  const palette = paletteForAnchor(base.color, base.colorHex);
  const first = palette[0] ?? { name: "Cream", hex: "#eee4cd" };
  const second = palette[1] ?? { name: "Denim Blue", hex: "#3a608c" };
  const third = palette[2] ?? { name: "Black", hex: "#141418" };
  const targetSlot = wardrobeSlot(group.value);

  if (targetSlot === "bottom") {
    return [
      {
        title: `${second.name} ${group.label.toLowerCase()}`,
        subtitle: "Best everyday balance",
        reason: `${second.name} grounds a ${base.color.toLowerCase()} ${base.category.toLowerCase()} without making the outfit too loud.`,
        swatch: second.hex,
      },
      {
        title: `${first.name} relaxed ${group.label.toLowerCase()}`,
        subtitle: "Soft coordinated look",
        reason: `A lighter bottom keeps the look breathable and polished for ${destination}.`,
        swatch: first.hex,
      },
      {
        title: `${third.name} structured ${group.label.toLowerCase()}`,
        subtitle: "Sharper evening option",
        reason: `A darker bottom adds contrast and makes the anchor item look more intentional.`,
        swatch: third.hex,
      },
    ].map((suggestion) => withVisualReference(suggestion, group.value));
  }

  if (targetSlot === "footwear") {
    return [
      {
        title: group.value === "Sandals" ? "Tan clean sandals" : group.value === "Loafers" ? `${third.name} loafers` : "White clean sneakers",
        subtitle: "Safe travel choice",
        reason: `Neutral footwear keeps the outfit fresh and works with most colors, especially ${base.color.toLowerCase()}.`,
        swatch: group.value === "Sandals" ? "#b98555" : group.value === "Loafers" ? third.hex : "#f5f3ee",
      },
      {
        title: `${third.name} flats or loafers`,
        subtitle: "Polished city option",
        reason: `A darker shoe balances the outfit if the upper piece is bright or patterned.`,
        swatch: third.hex,
      },
      {
        title: "Tan sandals",
        subtitle: "Soft casual option",
        reason: "Tan reads warm and relaxed without fighting the anchor color.",
        swatch: "#b98555",
      },
    ].map((suggestion) => withVisualReference(suggestion, group.value));
  }

  if (["Jewelry", "Watch"].includes(group.value)) {
  const metal = isWarmColor(base.color, base.colorHex) ? "gold" : "silver";
    return [
      {
        title: `Minimal ${metal} hoops`,
        subtitle: "Face-framing detail",
        reason: `${metal} jewelry complements the warmth and formality of the anchor piece.`,
        swatch: metal === "gold" ? "#d4af37" : "#c8ccd2",
      },
      {
        title: "Thin bracelet stack",
        subtitle: "Soft styling layer",
        reason: "Small metallic details finish the outfit without overpowering the garment.",
        swatch: "#d8c7a1",
      },
      {
        title: "Delicate pendant",
        subtitle: "Clean neckline accent",
        reason: "A pendant works especially well with kurtis, shirts, and plain tops.",
        swatch: "#f2dfbc",
      },
    ].map((suggestion) => withVisualReference(suggestion, group.value));
  }

  if (["Jacket", "Blazer"].includes(group.value)) {
    return [
      {
        title: `${third.name} structured ${group.label.toLowerCase()}`,
        subtitle: "Smart layering",
        reason: `A clean darker layer adds shape and makes the outfit more evening-ready in ${destination}.`,
        swatch: third.hex,
      },
      {
        title: `${first.name} light ${group.label.toLowerCase()}`,
        subtitle: "Softer daytime layer",
        reason: "A soft neutral layer keeps the anchor item visible while adding coverage.",
        swatch: first.hex,
      },
      {
        title: "Denim jacket",
        subtitle: "Casual contrast",
        reason: "Denim adds texture and works well with kurtis, dresses, and fitted tops.",
        swatch: "#3a608c",
      },
    ].map((suggestion) => withVisualReference(suggestion, group.value));
  }

  if (targetSlot === "top" || targetSlot === "onepiece") {
    return [
      {
        title: `${first.name} ${group.label.toLowerCase()}`,
        subtitle: "Clean tonal balance",
        reason: `A light neutral ${group.label.toLowerCase()} keeps the outfit soft around ${base.color.toLowerCase()}.`,
        swatch: first.hex,
      },
      {
        title: `${third.name} ${group.label.toLowerCase()}`,
        subtitle: "Sharper contrast",
        reason: "A darker upper piece creates structure and works well for photos or evening plans.",
        swatch: third.hex,
      },
      {
        title: `${second.name} ${group.label.toLowerCase()}`,
        subtitle: "Casual street-style option",
        reason: "Blue and denim tones are reliable when you want the look to feel relaxed.",
        swatch: second.hex,
      },
    ].map((suggestion) => withVisualReference(suggestion, group.value));
  }

  return [
    {
      title: group.value === "Sunglasses" ? "Brown tinted sunglasses" : `${first.name} ${group.label.toLowerCase()}`,
      subtitle: "Easy neutral anchor",
      reason: `A neutral ${group.label.toLowerCase()} lets the ${base.color.toLowerCase()} piece stay the hero.`,
      swatch: group.value === "Sunglasses" ? "#33312d" : first.hex,
    },
    {
      title: group.value === "Belt" ? "Slim brown belt" : `Slim ${third.name.toLowerCase()} accent`,
      subtitle: "Shape and proportion",
      reason: "A small structured accessory helps the outfit look finished without overdoing it.",
      swatch: group.value === "Belt" ? "#4b3325" : third.hex,
    },
    {
      title: "Minimal travel finish",
      subtitle: "Travel finish",
      reason: `${group.label} should support the outfit palette instead of competing with the anchor item.`,
      swatch: second.hex,
    },
  ].map((suggestion) => withVisualReference(suggestion, group.value));
}

function completeOutfitFormula(base: WardrobeItem, destination: string): StyleSuggestion[] {
  const palette = paletteForAnchor(base.color, base.colorHex);
  const bottom = palette[1] ?? { name: "Denim Blue", hex: "#3a608c" };
  const neutral = palette[0] ?? { name: "Cream", hex: "#eee4cd" };
  const dark = palette[2] ?? { name: "Black", hex: "#141418" };
  const anchorSlot = wardrobeSlot(base.category);
  const anchorName = `${base.color.toLowerCase()} ${base.category.toLowerCase()}`;
  const metal = isWarmColor(base.color, base.colorHex) ? "Gold" : "Silver";

  return [
    {
      title: anchorSlot === "bottom" ? `${neutral.name} fitted top` : `${bottom.name} straight bottom`,
      subtitle: anchorSlot === "bottom" ? "Balances your uploaded bottom" : "Keeps your uploaded top as the hero",
      reason: `This piece is chosen specifically to complement your uploaded ${anchorName}, not replace it.`,
      swatch: anchorSlot === "bottom" ? neutral.hex : bottom.hex,
    },
    {
      title: `${neutral.name} sneakers or tan flats`,
      subtitle: "Comfortable footwear",
      reason: `A quieter shoe lets the ${anchorName} stay central while staying practical for ${destination}.`,
      swatch: neutral.hex,
    },
    {
      title: `${dark.name} or tan bag`,
      subtitle: "Practical accessory",
      reason: `A grounding bag color connects the outfit back to your ${anchorName}.`,
      swatch: dark.hex,
    },
    {
      title: `${metal} minimal jewelry`,
      subtitle: "Finishing detail",
      reason: `${metal} details polish the look without overpowering your uploaded ${anchorName}.`,
      swatch: metal === "Gold" ? "#d4af37" : "#c8ccd2",
    },
  ].map((suggestion) => withVisualReference(suggestion, suggestion.title));
}

const warmAnchorColors = new Set(["Yellow", "Marigold", "Terracotta", "Cream", "Olive", "Brown", "Red", "Coral", "Beige"]);

function paletteForAnchor(color: string, colorHex?: string) {
  const palettes: Record<string, { name: string; hex: string }[]> = {
    Yellow: [
      { name: "Cream", hex: "#eee4cd" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Charcoal", hex: "#3e4040" },
    ],
    Marigold: [
      { name: "Ivory", hex: "#f4efe3" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Olive", hex: "#6a7e4c" },
    ],
    Red: [
      { name: "Ivory", hex: "#f4efe3" },
      { name: "Charcoal", hex: "#3e4040" },
      { name: "Camel", hex: "#b98555" },
    ],
    Coral: [
      { name: "Cream", hex: "#eee4cd" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Olive", hex: "#6a7e4c" },
    ],
    Black: [
      { name: "White", hex: "#f0f0eb" },
      { name: "Camel", hex: "#b98555" },
      { name: "Silver Grey", hex: "#8b8e90" },
    ],
    White: [
      { name: "Beige", hex: "#d1be9a" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Black", hex: "#141418" },
    ],
    Cream: [
      { name: "Brown", hex: "#754c31" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Olive", hex: "#6a7e4c" },
    ],
    Pink: [
      { name: "White", hex: "#f0f0eb" },
      { name: "Light Denim", hex: "#8fb0cb" },
      { name: "Charcoal", hex: "#3e4040" },
    ],
    Terracotta: [
      { name: "Cream", hex: "#eee4cd" },
      { name: "Olive", hex: "#6a7e4c" },
      { name: "Black", hex: "#141418" },
    ],
    Olive: [
      { name: "Cream", hex: "#eee4cd" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Brown", hex: "#754c31" },
    ],
    "Denim Blue": [
      { name: "White", hex: "#f0f0eb" },
      { name: "Pink", hex: "#d67796" },
      { name: "Black", hex: "#141418" },
    ],
    Charcoal: [
      { name: "Cream", hex: "#eee4cd" },
      { name: "White", hex: "#f0f0eb" },
      { name: "Pink", hex: "#d67796" },
    ],
  };

  return palettes[color] ?? paletteFromHex(colorHex);
}

function paletteFromHex(colorHex?: string) {
  const rgb = parseHexColor(colorHex);
  if (!rgb) {
    return [
      { name: "Soft Neutral", hex: "#eee4cd" },
      { name: "Denim Blue", hex: "#3a608c" },
      { name: "Deep Charcoal", hex: "#2f3336" },
    ];
  }

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const warm = hsl.h < 55 || hsl.h >= 330;
  const lightNeutral = warm ? { name: "Warm Ivory", hex: "#f4efe3" } : { name: "Soft Stone", hex: "#e7e3d8" };
  const complement = hslToHex((hsl.h + 180) % 360, Math.max(24, hsl.s * 0.58), Math.min(46, Math.max(30, hsl.l * 0.58)));
  const deepAccent = hslToHex(hsl.h, Math.max(24, hsl.s * 0.72), Math.max(18, Math.min(30, hsl.l * 0.42)));
  const complementName = warm ? "Cool Complement" : "Warm Complement";
  return [
    lightNeutral,
    { name: complementName, hex: complement },
    { name: "Deep Tonal Accent", hex: deepAccent },
  ];
}

function parseHexColor(colorHex?: string) {
  if (!colorHex || !/^#[0-9a-f]{6}$/i.test(colorHex)) return null;
  return {
    r: parseInt(colorHex.slice(1, 3), 16),
    g: parseInt(colorHex.slice(3, 5), 16),
    b: parseInt(colorHex.slice(5, 7), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) h = (green - blue) / delta + (green < blue ? 6 : 0);
    if (max === green) h = (blue - red) / delta + 2;
    if (max === blue) h = (red - green) / delta + 4;
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  return `#${[r, g, b]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function isWarmColor(color: string, colorHex?: string) {
  if (warmAnchorColors.has(color)) return true;
  const rgb = parseHexColor(colorHex);
  if (!rgb) return false;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hsl.h < 70 || hsl.h >= 330;
}

function matchCategoriesFor(category: string) {
  const slot = wardrobeSlot(category);
  if (slot === "top") return ["Jeans", "Trousers", "Skirt", "Shorts", "Sneakers", "Loafers", "Sandals", "Hat", "Scarf"];
  if (slot === "bottom") return ["Shirt", "T-shirt", "Topwear", "Blazer", "Jacket", "Sneakers", "Loafers", "Sandals", "Hat", "Scarf"];
  if (slot === "onepiece") return ["Sneakers", "Loafers", "Sandals", "Hat", "Scarf", "Blazer", "Jacket"];
  if (slot === "footwear") return ["Shirt", "T-shirt", "Topwear", "Dress", "Jeans", "Trousers", "Skirt"];
  return ["Shirt", "T-shirt", "Topwear", "Dress", "Jeans", "Trousers", "Skirt"];
}

function wardrobeSlot(category: string) {
  return CATEGORY_SLOT[category] ?? "piece";
}

function wardrobePairScore(base: WardrobeItem, candidate: WardrobeItem, popularColors: string[]) {
  const baseSlot = wardrobeSlot(base.category);
  const candidateSlot = wardrobeSlot(candidate.category);
  if (!canSuggestTogether(baseSlot, candidateSlot)) return 0;

  const palette = new Set(popularColors);
  let score = 54;
  if (base.color === candidate.color) score += 8;
  if (palette.has(base.color)) score += 8;
  if (palette.has(candidate.color)) score += 12;
  if (NEUTRAL_COLORS.has(base.color) || NEUTRAL_COLORS.has(candidate.color)) score += 9;
  if (base.breathable && candidate.breathable) score += 5;
  if (base.formality === candidate.formality) score += 5;
  if (candidateSlot === "footwear" || candidateSlot === "bottom") score += 6;
  return Math.max(1, Math.min(99, score));
}

function canSuggestTogether(baseSlot: string, candidateSlot: string) {
  if (baseSlot === candidateSlot && baseSlot !== "accessory") return false;
  if ((baseSlot === "top" && candidateSlot === "onepiece") || (baseSlot === "onepiece" && candidateSlot === "top")) return false;
  if ((baseSlot === "bottom" && candidateSlot === "onepiece") || (baseSlot === "onepiece" && candidateSlot === "bottom")) return false;
  return true;
}

function wardrobePairReason(base: WardrobeItem, candidate: WardrobeItem, destination: string) {
  if (base.color === candidate.color) return `Same-color styling keeps it clean for ${destination}.`;
  if (NEUTRAL_COLORS.has(candidate.color)) return `${candidate.color} is easy to balance with ${base.color}.`;
  if (candidate.breathable && base.breathable) return "Both pieces stay comfortable for travel movement.";
  if (candidate.formality === "Smart" || base.formality === "Smart") return "One smart piece keeps the look polished.";
  return "The categories balance each other better than a same-slot pairing.";
}

function wardrobePairAdvice(base: WardrobeItem, category: string, destination: string) {
  const color = base.color;
  const categoryText = category.toLowerCase();
  const palette: Record<string, string> = {
    Yellow: `A yellow ${base.category.toLowerCase()} works best with dark denim, charcoal, white, or cream ${categoryText}.`,
    Marigold: `A warm yellow ${base.category.toLowerCase()} looks balanced with blue denim, charcoal, olive, or cream ${categoryText}.`,
    Pink: `Pink pairs nicely with light denim, white, cream, charcoal, or soft blue ${categoryText}.`,
    Terracotta: `Terracotta looks strongest with cream, black, olive, beige, or washed denim ${categoryText}.`,
    Cream: `Cream is easy: try charcoal, denim blue, olive, brown, or black ${categoryText}.`,
    White: `White can go with almost anything, but denim blue, black, beige, and olive will look clean for ${destination}.`,
    Black: `Black is sharp with denim blue, cream, white, charcoal, or one lighter accent piece.`,
    Olive: `Olive works well with cream, white, black, denim blue, tan, and brown ${categoryText}.`,
    "Denim Blue": `Denim blue is a safe base with white, cream, pink, black, yellow, and terracotta.`,
    Charcoal: `Charcoal pairs best with cream, white, pink, denim blue, olive, or one brighter color accent.`,
  };
  return palette[color] ?? `${color} can work with neutral ${categoryText}: black, white, cream, denim, or beige are safest.`;
}

function InspirationFeed({
  inspiration,
  destination,
  gender
}: {
  inspiration: InspirationResponse | null;
  destination: string;
  gender: "women" | "men";
}) {
  const [selectedImage, setSelectedImage] = useState<InspirationItem | null>(null);
  const categories =
    inspiration?.categories && inspiration.categories.length
      ? inspiration.categories
      : [
          {
            id: "all",
            title: `${destination} references`,
            subtitle: "Visual direction for the destination.",
            query: inspiration?.query ?? destination,
            items: inspiration?.items ?? []
          }
        ];

  return (
    <>
    <article className="glass-panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/50 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-plum">Action 02</p>
          <h2 className="mt-1 text-xl font-semibold">See the destination style board</h2>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Outfit ideas, Pinterest searches, and local visual cues for {inspiration?.destination ?? destination}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-plum/10 px-3 py-1 text-xs font-bold capitalize text-plum">
              {inspiration?.gender ?? gender} references
            </span>
            <span className="rounded-full bg-reef/10 px-3 py-1 text-xs font-bold text-reef">
              Place-aware gallery
            </span>
          </div>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-plum/12 text-plum">
          <ImageIcon size={20} />
        </span>
      </div>

      <div className="grid gap-4 p-4">
        {inspiration?.pinterestBoards?.length ? <PinterestBoardStrip boards={inspiration.pinterestBoards} /> : null}

        {categories.map((category) => (
          <section key={category.id}>
            <div className="mb-3 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
              <div>
                <h3 className="font-semibold">{category.title}</h3>
                <p className="text-xs leading-5 text-ink/48">{category.subtitle}</p>
              </div>
              <a
                href={category.pinterestUrl ?? `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(category.query)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-reef underline decoration-reef/20 underline-offset-4"
              >
                More on Pinterest
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {category.items.map((item, index) => (
                <button
                  key={`${category.id}-${item.id}`}
                  type="button"
                  onClick={() => setSelectedImage(item)}
                  className={`group relative min-h-[210px] overflow-hidden rounded-[8px] bg-paper ${
                    index === 0 ? "col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="line-clamp-1 text-xs font-semibold">{item.title}</p>
                    {item.tags.length ? <p className="mt-1 line-clamp-1 text-[10px] text-white/70">{item.tags.join(" / ")}</p> : null}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">Tap to open</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/50 px-4 py-3 text-[10px] text-ink/42">
        <span>{inspiration?.socialPolicy ?? "Loading licensed visual references..."}</span>
        <span className="shrink-0 font-semibold">{inspiration?.source ?? "Editorial"}</span>
      </div>
    </article>
    {selectedImage ? <ImagePreviewModal item={selectedImage} onClose={() => setSelectedImage(null)} /> : null}
    </>
  );
}

function PinterestBoardStrip({ boards }: { boards: PinterestBoard[] }) {
  return (
    <section className="rounded-[8px] border border-[#e60023]/12 bg-white/72 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e60023]">Pinterest live boards</p>
          <h3 className="text-base font-semibold">Open exact destination searches</h3>
        </div>
        <span className="rounded-full bg-[#e60023]/10 px-3 py-1 text-xs font-bold text-[#e60023]">Live links</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {boards.map((board) => (
          <a
            key={board.url}
            href={board.url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-[132px] flex-col justify-between rounded-[8px] bg-[#fff4f6] p-3 text-left transition hover:bg-[#ffe8ed]"
          >
            <div>
              <p className="line-clamp-2 text-sm font-bold text-ink">{board.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/50">{board.subtitle}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="line-clamp-1 text-[10px] font-semibold text-[#e60023]/72">{board.query}</p>
              <ExternalLink size={15} className="shrink-0 text-[#e60023] transition group-hover:translate-x-0.5" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function ImagePreviewModal({
  item,
  onClose
}: {
  item: InspirationItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b1f]/78 p-4 backdrop-blur-sm">
      <div className="relative grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[8px] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.38)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[58vh] bg-ink">
          <img src={item.imageUrl} alt={item.title} className="absolute inset-0 h-full w-full object-contain" />
        </div>
        <aside className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-reef">Style reference</p>
              <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper text-ink/64"
              aria-label="Close image preview"
            >
              <X size={17} />
            </button>
          </div>
          {item.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-reef/10 px-3 py-1 text-xs font-bold text-reef">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-sm leading-6 text-ink/58">
            Use this as a visual cue for silhouette, color, layering, and the overall destination mood.
          </p>
          {item.photographer ? <p className="text-xs text-ink/44">Credit: {item.photographer}</p> : null}
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-auto flex h-11 items-center justify-center rounded-[8px] bg-ink px-4 text-sm font-bold text-white"
            >
              Open original source
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ColorPalette({ colors }: { colors: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {colors.map((color) => (
        <div key={color} className="flex items-center gap-2 rounded-full bg-paper py-1.5 pl-1.5 pr-3 text-xs font-semibold">
          <span className="h-7 w-7 rounded-full border border-black/8" style={{ backgroundColor: colorHex(color) }} />
          {color}
        </div>
      ))}
    </div>
  );
}

function AdviceList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${warning ? "text-coral" : "text-reef"}`}>{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <p key={item} className="text-sm text-ink/62">{warning ? "- " : "+ "}{item}</p>
        ))}
      </div>
    </div>
  );
}

function colorHex(color: string) {
  const colors: Record<string, string> = {
    White: "#f4f3ed",
    Beige: "#d7c3a1",
    "Sky Blue": "#8bc7e8",
    Coral: "#e86f5c",
    Black: "#1b1e21",
    Cream: "#eee3cd",
    Navy: "#243a62",
    Red: "#b84040",
    Ivory: "#f1ead8",
    Marigold: "#e8a92f",
    Indigo: "#41598b",
    Terracotta: "#bd704f",
    Charcoal: "#4a4d50",
    Olive: "#778152",
    "Forest Green": "#365d48",
    Burgundy: "#783848",
    Sage: "#9cae91",
    "Dusty Rose": "#c99298",
    "Pale Blue": "#a9c9dc",
    Gold: "#d6aa3d",
    Sand: "#ccb98e",
    "Denim Blue": "#537aa5",
    Chrome: "#bfc4c8",
    Blue: "#4f83b8",
    Neutral: "#aaa398"
  };
  return colors[color] ?? "#c8c3b8";
}

function MixMatchHighlights({ outfits }: { outfits: OutfitResponse | null }) {
  if (!outfits) return <EmptyState text="Analyzing your uploaded wardrobe..." />;
  const matchedOutfits = outfits.outfits.filter((item) => item.items.length);
  if (!matchedOutfits.length) return <MissingComboState ownedItemCount={outfits.ownedItemCount} compact />;
  const coveredItems = new Set(matchedOutfits.flatMap((outfit) => outfit.items.map((item) => item.id))).size;
  return (
    <div className="mt-3 rounded-[8px] border border-coral/18 bg-[linear-gradient(135deg,#fff7f2,#ffffff)] p-3 shadow-[0_14px_36px_rgba(232,111,92,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-coral">
            <Shuffle size={13} />
            Mix-match results
          </p>
          <h3 className="mt-1 font-semibold">{matchedOutfits.length} combinations checked</h3>
          <p className="mt-1 text-xs text-ink/52">{coveredItems} uploaded pieces included in the analysis.</p>
        </div>
        <span className="rounded-full bg-coral/12 px-3 py-1 text-sm font-bold text-coral">{matchedOutfits[0].matchScore}%</span>
      </div>

      <div className="mt-3 grid gap-2">
        {matchedOutfits.slice(0, 4).map((outfit) => (
          <div key={outfit.name} className="rounded-[8px] border border-ink/5 bg-white/88 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{outfit.name}</p>
              <span className="text-xs font-bold text-reef">{outfit.matchScore}%</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink/56">{outfit.items.map((item) => item.name).join(" + ")}</p>
            {outfit.pairings?.[0] ? (
              <p className="mt-2 rounded-[8px] bg-paper px-3 py-2 text-xs leading-5 text-ink/58">
                {outfit.pairings[0].itemA} + {outfit.pairings[0].itemB}: {outfit.pairings[0].reason}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function OutfitsPanel({
  analysis,
  featuredItem,
  wardrobeItems,
  outfits,
  pairingGoal,
  showAnalysis,
  onSelectItem
}: {
  analysis: DestinationAnalysis | null;
  featuredItem: WardrobeItem | null;
  wardrobeItems: WardrobeItem[];
  outfits: OutfitResponse | null;
  pairingGoal: string;
  showAnalysis: boolean;
  onSelectItem: (item: WardrobeItem) => void;
}) {
  if (!featuredItem) {
    return <EmptyState text="Upload an anchor item first. Your pairings and complete outfit plan will appear here." />;
  }

  const group = pairingGroupFromGoal(pairingGoal);
  const destination = analysis?.destination ?? "this trip";
  const matches = wardrobeItems
    .filter((item) => item.id !== featuredItem.id && group.categories.includes(item.category))
    .map((item) => ({
      item,
      score: wardrobePairScore(featuredItem, item, analysis?.popularColors ?? []),
      reason: wardrobePairReason(featuredItem, item, destination),
    }))
    .filter((match) => match.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 8);
  const idealSuggestions = idealPairingSuggestions(featuredItem, group, destination);
  const completeLook = completeOutfitFormula(featuredItem, destination);

  return (
    <div className="rounded-[8px] border border-white/70 bg-white p-4 shadow-soft">
      <FashionAssistantResult
        group={group}
        featuredItem={featuredItem}
        matches={matches}
        idealSuggestions={idealSuggestions}
        completeLook={completeLook}
        destination={destination}
        onSelectItem={onSelectItem}
      />
      {showAnalysis ? (
        <div className="mt-4">
          <MixMatchHighlights outfits={outfits} />
        </div>
      ) : null}
    </div>
  );
}

function MissingComboState({ ownedItemCount, compact = false }: { ownedItemCount: number; compact?: boolean }) {
  const nextItems = ["Jeans", "Trousers", "Skirt", "Sneakers", "Sandals"];
  return (
    <div className={`rounded-[8px] border border-coral/18 bg-white shadow-sm ${compact ? "p-3" : "p-6"}`}>
      <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-coral">
        <Shuffle size={13} />
        No complete mix yet
      </p>
      <h3 className={`${compact ? "mt-1 text-sm" : "mt-2 text-lg"} text-center font-semibold`}>
        {ownedItemCount ? `${ownedItemCount} item${ownedItemCount === 1 ? "" : "s"} uploaded, but no outfit pair is complete.` : "Upload clothing photos first."}
      </h3>
      <p className={`mx-auto mt-2 max-w-md text-center ${compact ? "text-xs leading-5" : "text-sm leading-6"} text-ink/56`}>
        Right now your uploads look like the same clothing slot. Add or recategorize one bottom, shoe, or accessory so the app can create a real outfit.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {nextItems.map((item) => (
          <span key={item} className="rounded-full bg-reef/10 px-3 py-1 text-xs font-bold text-reef">{item}</span>
        ))}
      </div>
    </div>
  );
}

function TrendsPanel({ analysis }: { analysis: DestinationAnalysis | null }) {
  if (!analysis) return <EmptyState text="Trend profile loading..." />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[8px] bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Destination Fashion Profile</h2>
        <p className="mt-1 text-sm text-ink/62">{analysis.seasonalClimate}</p>
        <div className="mt-5 grid gap-4">
          {Object.entries(analysis.fashionProfile).map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-sm font-semibold">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-reef" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </article>
      <article className="glass-panel overflow-hidden">
        <div className="border-b border-white/58 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-reef">Local Signals</p>
          <h2 className="mt-1 text-xl font-semibold">What the place is telling you to wear</h2>
          <p className="mt-1 text-sm leading-6 text-ink/52">
            A cleaner read of colors, useful garments, cultural cues, and pieces to avoid.
          </p>
        </div>
        <div className="grid gap-3 p-4">
          <LocalColorSignals colors={analysis.popularColors} />
          <SignalSection title="Recommended" items={analysis.recommendedItems} />
          <SignalSection title="Avoid" items={analysis.avoidItems} tone="warning" />
        </div>
        <div className="grid gap-2 border-t border-white/58 p-4">
          {analysis.culturalNotes.map((note, index) => (
            <div key={note} className="rounded-[8px] border border-ink/6 bg-white/68 p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/36">Cue {index + 1}</p>
              <p className="mt-1 text-sm leading-6 text-ink/70">{note}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function LocalColorSignals({ colors }: { colors: string[] }) {
  return (
    <section className="rounded-[8px] bg-white/64 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">Colors</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {colors.map((color) => (
          <div key={color} className="flex items-center gap-2 rounded-[8px] bg-paper/82 p-2 text-sm font-bold text-ink/72">
            <span className="h-8 w-8 rounded-full border border-black/8 shadow-inner" style={{ backgroundColor: colorHex(color) }} />
            {color}
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalSection({
  title,
  items,
  tone = "default"
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  return (
    <section className="rounded-[8px] bg-white/64 p-3">
      <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${tone === "warning" ? "text-coral" : "text-reef"}`}>
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              tone === "warning" ? "bg-coral/10 text-coral" : "bg-reef/10 text-reef"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function WardrobePanel({ items }: { items: WardrobeItem[] }) {
  if (!items.length) return <EmptyState text="Upload clothing photos to build your wardrobe." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[8px] bg-white p-4 shadow-sm">
          <div className="mb-4 h-24 rounded-[8px] border border-ink/8" style={{ backgroundColor: item.colorHex }} />
          <h2 className="font-semibold">{item.name}</h2>
          <p className="mt-1 text-sm text-ink/60">
            {item.color} {item.material} {item.category}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-paper px-3 py-1">{item.style}</span>
            <span className="rounded-full bg-paper px-3 py-1">{item.season}</span>
            <span className="rounded-full bg-paper px-3 py-1">{item.breathable ? "Breathable" : "Structured"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function PackingPanel({ packing }: { packing: PackingList | null }) {
  if (!packing) return <EmptyState text="Packing list loading..." />;
  const sections = [
    { title: "Clothing", items: packing.clothing },
    { title: "Accessories", items: packing.accessories },
    { title: "Weather ready", items: packing.weatherReady ?? [] },
    { title: "Toiletries", items: packing.toiletries ?? [] },
    { title: "Tech", items: packing.tech ?? [] },
    { title: "Documents", items: packing.documents },
    { title: "Local prep", items: packing.localPrep ?? [] }
  ].filter((section) => section.items.length);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <Checklist key={section.title} title={section.title} items={section.items} />
      ))}
    </div>
  );
}

function DancePanel({ dance }: { dance: DancePlan | null }) {
  if (!dance) return <EmptyState text="Dance mode loading..." />;
  return (
    <article className="rounded-[8px] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dance Training Mode</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/64">{dance.message}</p>
        </div>
        <span className="rounded-full bg-plum/12 px-3 py-1 text-sm font-semibold text-plum">
          {dance.enabled ? "Camera-ready" : "Optional"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {dance.tutorial.map((step) => (
          <div key={step.count} className="rounded-[8px] bg-paper p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-reef">Count {step.count}</p>
            <p className="mt-1 font-semibold">{step.name}</p>
            <p className="mt-1 text-sm text-ink/62">{step.feedbackCue}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 rounded-[8px] bg-ink p-3 text-sm text-white">{dance.recommendedModel}</p>
    </article>
  );
}

function ReelStudioPanel({ reels }: { reels: ReelStudio | null }) {
  if (!reels) return <EmptyState text="Reel studio loading..." />;
  return (
    <article className="glass-panel overflow-hidden">
      <div className="grid gap-4 border-b border-white/58 p-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-plum">For {reels.destination}</p>
          <h2 className="mt-1 text-xl font-semibold">Make a destination-ready reel</h2>
          <p className="mt-2 text-sm leading-6 text-ink/56">{reels.sourcePolicy}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reels.hashtags.map((tag) => (
              <a
                key={tag}
                href={`https://www.instagram.com/explore/tags/${tag}/`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-plum/10 px-3 py-1 text-xs font-bold text-plum transition hover:bg-plum/16"
              >
                #{tag}
              </a>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          {reels.platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[54px] items-center justify-between gap-2 rounded-[8px] bg-white/70 px-3 text-sm font-bold text-ink shadow-sm transition hover:bg-white"
            >
              {platform.name}
              <ExternalLink size={15} className="text-reef" />
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Headphones size={18} className="text-plum" />
            <h3 className="font-semibold">Trending audio search prompts</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {reels.audioIdeas.map((idea) => (
              <article key={idea.title} className="rounded-[8px] bg-white/70 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{idea.title}</p>
                    <p className="mt-1 text-xs leading-5 text-ink/50">{idea.mood}</p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-plum/10 text-plum">
                    <Play size={16} />
                  </span>
                </div>
                <p className="mt-3 rounded-[8px] bg-paper/78 p-2 text-xs font-semibold text-ink/58">{idea.query}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {idea.links.map((link) => (
                    <a
                      key={`${idea.title}-${link.platform}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-reef/10 px-3 py-1 text-xs font-bold text-reef transition hover:bg-reef/16"
                    >
                      {link.platform}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Film size={18} className="text-reef" />
            <h3 className="font-semibold">Reel ideas</h3>
          </div>
          <div className="grid gap-2">
            {reels.contentIdeas.map((idea) => (
              <article key={idea.title} className="rounded-[8px] bg-white/70 p-3 shadow-sm">
                <p className="font-semibold">{idea.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink/58">{idea.prompt}</p>
                <p className="mt-2 text-xs font-semibold text-reef">{idea.caption}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function ShopPanel({ outfits }: { outfits: OutfitResponse | null }) {
  if (!outfits) return <EmptyState text="Shopping gaps loading..." />;
  if (!outfits.shoppingRecommendations.length) return <EmptyState text="No major gaps detected." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {outfits.shoppingRecommendations.map((group) => (
        <article key={group.item} className="rounded-[8px] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{group.item}</h2>
          <p className="mt-1 text-xs text-ink/55">{group.note}</p>
          <div className="mt-4 grid gap-2">
            {group.products.map((product) => (
              <a
                key={`${group.item}-${product.merchant}`}
                href={product.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[8px] bg-paper p-3 transition hover:bg-saffron/18"
              >
                <div>
                  <p className="font-semibold">{product.merchant}</p>
                  <p className="text-sm text-ink/60">{product.name}</p>
                  <p className="text-xs text-ink/42">{product.priceRange}</p>
                </div>
                <span className="text-sm font-bold text-reef">{product.ratingEstimate}</span>
              </a>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function TagGroup({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warning" }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink/45">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              tone === "warning" ? "bg-coral/12 text-coral" : "bg-reef/10 text-reef"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  const storageKey = `travel-stylist:checklist:${title.toLowerCase().replace(/\s+/g, "-")}`;
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setCustomItems(JSON.parse(saved) as string[]);
    } catch {
      setCustomItems([]);
    }
  }, [storageKey]);

  function saveCustomItems(nextItems: string[]) {
    setCustomItems(nextItems);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
    } catch {
      // Checklist still works for the current session if storage is unavailable.
    }
  }

  function addCustomItem() {
    const value = draft.trim();
    if (!value) return;
    const existing = new Set([...items, ...customItems].map((item) => item.toLowerCase()));
    if (existing.has(value.toLowerCase())) {
      setDraft("");
      return;
    }
    saveCustomItems([...customItems, value]);
    setDraft("");
  }

  function removeCustomItem(item: string) {
    saveCustomItems(customItems.filter((customItem) => customItem !== item));
  }

  const allItems = [...items, ...customItems];

  return (
    <article className="glass-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-reef/10 px-2.5 py-1 text-xs font-bold text-reef">{allItems.length}</span>
      </div>

      <div className="mt-3 flex gap-2 rounded-[8px] bg-white/68 p-2 shadow-sm">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomItem();
            }
          }}
          placeholder={`Add ${title.toLowerCase()} item`}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium outline-none placeholder:text-ink/34"
        />
        <button
          type="button"
          onClick={addCustomItem}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-reef text-white transition hover:bg-[#0b7c77]"
          aria-label={`Add ${title} checklist item`}
        >
          <Plus size={17} />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {allItems.map((item) => {
          const isCustom = customItems.includes(item);
          return (
          <label key={`${title}-${item}`} className="flex items-start gap-3 rounded-[8px] bg-white/68 p-3 text-sm font-medium shadow-sm transition hover:bg-white">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-reef" />
            <span className="leading-5">{item}</span>
            {isCustom ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  removeCustomItem(item);
                }}
                className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"
                aria-label={`Remove ${item}`}
              >
                <X size={13} />
              </button>
            ) : null}
          </label>
          );
        })}
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[8px] bg-white p-6 text-center text-sm font-medium text-ink/58 shadow-sm">{text}</div>;
}
