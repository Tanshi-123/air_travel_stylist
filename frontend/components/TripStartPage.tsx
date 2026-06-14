"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Globe2,
  LocateFixed,
  LocateOff,
  MapPin,
  MoonStar,
  Navigation,
  ShieldCheck,
  Shirt,
  X
} from "lucide-react";
import { motion } from "framer-motion";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { detectApproximateLocation, DetectedLocation, reverseGeocode } from "@/lib/api";

type TripStartPageProps = {
  initialDestination: string;
  initialOrigin: string;
  initialTripDays: number;
  initialTravelStyle: string;
  initialStartDate: string;
  initialEndDate: string;
  initialGender: "women" | "men";
  loading: boolean;
  onBack: () => void;
  onStart: (
    destination: string,
    tripDays: number,
    origin: string,
    travelStyle: string,
    startDate: string,
    endDate: string,
    gender: "women" | "men"
  ) => void;
};

type LocationState = "idle" | "prompt" | "locating" | "approximate" | "found" | "denied" | "error";

const popularDestinations = ["Goa", "Lucknow", "Paris", "London", "New York", "Norway", "Tokyo", "Dubai", "Kashmir"];

const travelStyles = [
  { id: "style", label: "Style-first", caption: "Looks and wardrobe", Icon: Shirt },
  { id: "culture", label: "Local culture", caption: "Customs and places", Icon: Compass },
  { id: "nightlife", label: "After dark", caption: "Music and nightlife", Icon: MoonStar }
];

export function TripStartPage({
  initialDestination,
  initialOrigin,
  initialTripDays,
  initialTravelStyle,
  initialStartDate,
  initialEndDate,
  initialGender,
  loading,
  onBack,
  onStart
}: TripStartPageProps) {
  const [destination, setDestination] = useState(initialDestination);
  const [origin, setOrigin] = useState(initialOrigin === "Current location" ? "" : initialOrigin);
  const [tripDays, setTripDays] = useState(initialTripDays);
  const [travelStyle, setTravelStyle] = useState(initialTravelStyle);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [gender, setGender] = useState<"women" | "men">(initialGender);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [formError, setFormError] = useState("");
  const [showLocationHelp, setShowLocationHelp] = useState(false);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        setLocationState(status.state === "denied" ? "denied" : status.state === "prompt" ? "prompt" : "idle");
        status.onchange = () => {
          setLocationState(status.state === "denied" ? "denied" : status.state === "prompt" ? "prompt" : "idle");
        };
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setDestination(initialDestination);
    setOrigin(initialOrigin === "Current location" ? "" : initialOrigin);
    setTripDays(initialTripDays);
    setTravelStyle(initialTravelStyle);
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setGender(initialGender);
  }, [initialDestination, initialOrigin, initialTripDays, initialTravelStyle, initialStartDate, initialEndDate, initialGender]);

  function detectLocation() {
    setFormError("");
    setDetectedLocation(null);

    if (!navigator.geolocation) {
      setLocationState("error");
      setFormError("This browser does not support GPS location.");
      return;
    }

    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await reverseGeocode(coords.latitude, coords.longitude);
          setDetectedLocation(result);
          setOrigin(result.shortLabel);
          setLocationState("found");
        } catch {
          const coordinates = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
          setOrigin(coordinates);
          setDetectedLocation({
            resolved: false,
            latitude: coords.latitude,
            longitude: coords.longitude,
            label: coordinates,
            shortLabel: coordinates,
            city: null,
            district: null,
            state: null,
            country: null,
            countryCode: "",
            postcode: null,
            areaParts: [],
            mapUrl: `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}`,
            provider: "Browser GPS",
            attribution: "Coordinates detected on this device"
          });
          setLocationState("found");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationState("denied");
          setFormError("GPS access is blocked. Enable location for localhost in your browser, or enter your city.");
          return;
        }
        setLocationState("error");
        setFormError(
          error.code === error.TIMEOUT
            ? "GPS took too long to respond. Try again or enter your city."
            : "Your current position could not be detected."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  }

  async function detectApproximateArea() {
    setFormError("");
    setLocationState("locating");
    try {
      const result = await detectApproximateLocation();
      setDetectedLocation(result);
      setOrigin(result.shortLabel);
      setLocationState("approximate");
      setShowLocationHelp(false);
    } catch {
      setLocationState("denied");
      setFormError("Approximate location is unavailable. Enter your starting city manually.");
    }
  }

  function handleGpsAction() {
    if (locationState === "denied") {
      setShowLocationHelp(true);
      return;
    }
    detectLocation();
  }

  function submitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destination.trim()) {
      setFormError("Enter the destination you want to explore.");
      return;
    }
    const days = tripDaysBetween(startDate, endDate);
    if (days < 1 || days > 7) {
      setFormError("Choose travel dates within the next 7 days.");
      return;
    }
    onStart(destination.trim(), days, origin.trim() || "Current location", travelStyle, startDate, endDate, gender);
  }

  return (
    <main className="min-h-screen bg-[#edeae3] p-2 sm:p-4">
      <section className="trip-start-hero mx-auto min-h-[calc(100vh-16px)] max-w-[1560px] overflow-hidden rounded-[8px] text-white shadow-[0_28px_100px_rgba(19,30,35,0.28)] sm:min-h-[calc(100vh-32px)]">
        <div className="flex min-h-[calc(100vh-16px)] flex-col px-5 pb-5 pt-5 sm:min-h-[calc(100vh-32px)] sm:px-8 sm:pb-7 lg:px-12 lg:pt-7">
          <header className="flex items-center justify-between gap-4">
            <button type="button" onClick={onBack} className="flex items-center gap-3 text-left">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f7ca73] text-[#163035] shadow-lg">
                <ArrowLeft size={20} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/58">Back to welcome</p>
                <p className="text-xl font-semibold">Set up your trip</p>
              </div>
            </button>
            <div className="hidden items-center gap-6 text-sm font-semibold text-white/72 md:flex">
              <span>Plan</span>
              <span>Style</span>
              <span>Discover</span>
              <span className="h-4 w-px bg-white/24" />
              <span className="flex items-center gap-2 text-white">
                <Globe2 size={16} />
                Local mode
              </span>
            </div>
          </header>

          <div className="grid flex-1 items-end gap-8 pb-1 pt-10 lg:grid-cols-[minmax(0,1fr)_500px] lg:items-center lg:gap-12 lg:pt-4">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="max-w-[660px] self-center lg:pb-8"
            >
              <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#f7ca73]">
                <Navigation size={17} />
                Your local edge, before takeoff
              </p>
              <h1 className="max-w-[650px] font-serif text-5xl leading-[0.94] sm:text-6xl lg:text-[76px]">
                Travel like you know the place.
              </h1>
              <p className="mt-6 max-w-[570px] text-base leading-7 text-white/76 sm:text-lg">
                Enter any city, region, or country. The guide reads live global weather, then builds style, culture, and packing decisions around it.
              </p>

              <div className="mt-8 grid max-w-[610px] gap-px overflow-hidden rounded-[8px] border border-white/18 bg-white/18 sm:grid-cols-3">
                {[
                  ["01", "Weather-aware", "Outfits that feel right"],
                  ["02", "Culture-ready", "Etiquette without guesswork"],
                  ["03", "Locally tuned", "Trends, places, and nights"]
                ].map(([number, title, text]) => (
                  <div key={number} className="bg-[#112c31]/68 p-4 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f7ca73]">{number}</p>
                    <p className="mt-2 font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/58">{text}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              onSubmit={submitTrip}
              className="w-full rounded-[8px] border border-white/30 bg-[#fbfaf6]/97 p-4 text-[#182b2f] shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#182b2f]/10 pb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0e8f8a]">Create your trip</p>
                  <h2 className="mt-1 text-2xl font-semibold">Set the journey</h2>
                  <p className="mt-1 text-sm text-[#182b2f]/52">A few details. One personal local guide.</p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5f2ef] text-[#0e8f8a]">
                  <MapPin size={20} />
                </span>
              </div>

              <div className="mt-5">
                <FormLabel number="01" htmlFor="destination">
                  Destination
                </FormLabel>
                <div className="mt-2 flex h-14 items-center gap-3 rounded-[8px] border border-[#182b2f]/14 bg-white px-4 transition focus-within:border-[#0e8f8a] focus-within:ring-2 focus-within:ring-[#0e8f8a]/12">
                  <Compass size={19} className="shrink-0 text-[#0e8f8a]" />
                  <input
                    id="destination"
                    list="destination-suggestions"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="City, region, or country"
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-[#182b2f]/34"
                  />
                  <datalist id="destination-suggestions">
                    {popularDestinations.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="mt-4">
                <FormLabel number="02" htmlFor="origin">
                  Starting point
                </FormLabel>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="flex h-14 items-center gap-3 rounded-[8px] border border-[#182b2f]/14 bg-white px-4 focus-within:border-[#0e8f8a]">
                    <MapPin size={18} className="shrink-0 text-[#182b2f]/38" />
                    <input
                      id="origin"
                      value={origin}
                      onChange={(event) => {
                        setOrigin(event.target.value);
                        setDetectedLocation(null);
                      }}
                      placeholder="Enter your city"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[#182b2f]/34"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGpsAction}
                    disabled={locationState === "locating"}
                    className={`flex h-14 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-bold transition ${
                      locationState === "found" || locationState === "approximate"
                        ? "bg-[#0e8f8a] text-white"
                        : locationState === "denied"
                          ? "bg-[#f4ebe8] text-[#b85247] hover:bg-[#eeded9]"
                        : "bg-[#e5f2ef] text-[#0b7772] hover:bg-[#d4eae6]"
                    }`}
                  >
                    {locationState === "denied" ? (
                      <LocateOff size={18} />
                    ) : (
                      <LocateFixed size={18} className={locationState === "locating" ? "animate-pulse" : ""} />
                    )}
                    {locationButtonLabel(locationState)}
                  </button>
                </div>

                {detectedLocation ? (
                  <div className="mt-2 border-l-2 border-[#0e8f8a] bg-[#e9f4f1] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0b7772]">
                          <Check size={14} strokeWidth={3} />
                          {locationState === "approximate" ? "Approximate area found" : "GPS area found"}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold">{detectedLocation.label}</p>
                      </div>
                      {detectedLocation.city ? (
                        <button
                          type="button"
                          onClick={() => setDestination(detectedLocation.city ?? detectedLocation.shortLabel)}
                          className="shrink-0 text-xs font-bold text-[#0b7772] underline decoration-[#0b7772]/30 underline-offset-4"
                        >
                          Set as destination
                        </button>
                      ) : null}
                    </div>
                    {detectedLocation.areaParts.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detectedLocation.areaParts.slice(0, 4).map((area) => (
                          <span key={area} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#182b2f]/62">
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <a
                      href={detectedLocation.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[10px] font-medium text-[#182b2f]/42 hover:text-[#0b7772]"
                    >
                      {detectedLocation.attribution}
                    </a>
                  </div>
                ) : locationState === "denied" ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[#f8efec] px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 font-semibold text-[#9e4b43]">
                      <LocateOff size={14} />
                      Exact GPS is blocked
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowLocationHelp(true)}
                        className="font-bold text-[#9e4b43] underline underline-offset-4"
                      >
                        Fix permission
                      </button>
                      <button
                        type="button"
                        onClick={() => void detectApproximateArea()}
                        className="font-bold text-[#0b7772] underline underline-offset-4"
                      >
                        Use approximate area
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-[11px] leading-5 text-[#182b2f]/42">
                    <ShieldCheck size={14} className="shrink-0" />
                    GPS is requested only after you tap Use GPS. Coordinates are used once to identify your area.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <FormLabel number="03">Travel dates</FormLabel>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <DateInput
                    label="From"
                    value={startDate}
                    min={todayIso()}
                    max={addDaysIso(todayIso(), 6)}
                    onChange={(value) => {
                      const nextEnd = clampEndDate(value, endDate);
                      setStartDate(value);
                      setEndDate(nextEnd);
                      setTripDays(tripDaysBetween(value, nextEnd));
                    }}
                  />
                  <DateInput
                    label="To"
                    value={endDate}
                    min={startDate}
                    max={addDaysIso(startDate, Math.min(6, daysBetween(startDate, addDaysIso(todayIso(), 6))))}
                    onChange={(value) => {
                      setEndDate(value);
                      setTripDays(tripDaysBetween(startDate, value));
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#182b2f]/42">
                  Forecast-based styling is limited to a 7-day travel window.
                </p>
              </div>

              <div className="mt-4">
                <FormLabel number="04">Style profile</FormLabel>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: "women", label: "Women", caption: "Kurti, dresses, layers, accessories" },
                    { id: "men", label: "Men", caption: "Shirts, kurtas, jackets, footwear" }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setGender(option.id as "women" | "men")}
                      className={`min-h-[72px] rounded-[8px] border px-3 py-3 text-left transition ${
                        gender === option.id
                          ? "border-[#0e8f8a] bg-[#e5f2ef] text-[#0b7772]"
                          : "border-[#182b2f]/10 bg-white text-[#182b2f]/62 hover:border-[#182b2f]/24"
                      }`}
                    >
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-[#182b2f]/42">{option.caption}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <FormLabel number="05">Travel focus</FormLabel>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {travelStyles.map(({ id, label, caption, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTravelStyle(id)}
                      className={`min-h-[86px] rounded-[8px] border px-2 py-3 text-center transition ${
                        travelStyle === id
                          ? "border-[#0e8f8a] bg-[#e5f2ef] text-[#0b7772] shadow-[inset_0_0_0_1px_rgba(14,143,138,0.12)]"
                          : "border-[#182b2f]/10 bg-white text-[#182b2f]/62 hover:border-[#182b2f]/24"
                      }`}
                    >
                      <Icon size={18} className="mx-auto" />
                      <span className="mt-2 block text-xs font-bold">{label}</span>
                      <span className="mt-1 hidden text-[10px] text-[#182b2f]/42 sm:block">{caption}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formError ? <p className="mt-3 text-sm font-semibold text-[#cf5b4d]">{formError}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-[8px] bg-[#e86f5c] px-5 font-bold text-white shadow-[0_14px_34px_rgba(232,111,92,0.32)] transition hover:bg-[#d96151] hover:shadow-[0_16px_40px_rgba(232,111,92,0.4)] disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Composing your trip..." : "Build my local guide"}
                <ArrowRight size={19} />
              </button>
            </motion.form>
          </div>
        </div>
      </section>

      {showLocationHelp ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b1f]/62 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[8px] bg-white p-5 text-[#182b2f] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b85247]">GPS permission blocked</p>
                <h3 className="mt-1 text-xl font-semibold">Allow location for this site</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationHelp(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#f1eee7] text-[#182b2f]/62"
                aria-label="Close location help"
              >
                <X size={17} />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[#182b2f]/68">
              <li><strong>1.</strong> Click the site-controls icon beside <strong>localhost:3000</strong>.</li>
              <li><strong>2.</strong> Change <strong>Location</strong> to <strong>Allow</strong>.</li>
              <li><strong>3.</strong> Reload the page, then tap <strong>Use GPS</strong>.</li>
            </ol>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void detectApproximateArea()}
                className="h-11 rounded-[8px] bg-[#e5f2ef] px-4 text-sm font-bold text-[#0b7772]"
              >
                Use approximate area
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-11 rounded-[8px] bg-[#183236] px-4 text-sm font-bold text-white"
              >
                Reload after allowing
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[#182b2f]/42">
              Approximate area uses your public IP and does not provide street-level accuracy.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FormLabel({
  number,
  htmlFor,
  children
}: {
  number: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#182b2f]/44">
      <span className="text-[#0e8f8a]">{number}</span>
      <span className="h-px w-4 bg-[#182b2f]/16" />
      {children}
    </label>
  );
}

function DateInput({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[8px] border border-[#182b2f]/12 bg-white px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#182b2f]/38">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full bg-transparent text-sm font-bold outline-none"
      />
    </label>
  );
}

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

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function tripDaysBetween(startIso: string, endIso: string) {
  return daysBetween(startIso, endIso) + 1;
}

function clampEndDate(startIso: string, endIso: string) {
  const maxEnd = addDaysIso(startIso, Math.min(6, daysBetween(startIso, addDaysIso(todayIso(), 6))));
  if (endIso < startIso) return startIso;
  if (endIso > maxEnd) return maxEnd;
  return endIso;
}

function locationButtonLabel(state: LocationState) {
  if (state === "locating") return "Locating...";
  if (state === "found") return "Located";
  if (state === "approximate") return "Area found";
  if (state === "denied") return "GPS blocked";
  return "Use GPS";
}
