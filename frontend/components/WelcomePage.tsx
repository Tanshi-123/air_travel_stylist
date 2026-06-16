"use client";

import { ArrowRight, Compass, LocateFixed, MoonStar, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type WelcomePageProps = {
  onExplore: () => void;
};

const signals = [
  {
    label: "Destination weather",
    detail: "Forecast for the place you enter",
    Icon: LocateFixed
  },
  {
    label: "Local style",
    detail: "Dress for the destination",
    Icon: Sparkles
  },
  {
    label: "Culture + nights",
    detail: "Know where the city moves",
    Icon: MoonStar
  }
];

export function WelcomePage({ onExplore }: WelcomePageProps) {
  return (
    <main className="min-h-screen bg-[#edf0ed] p-2 sm:p-4">
      <section className="welcome-hero mx-auto flex min-h-[calc(100vh-16px)] max-w-[1560px] flex-col overflow-hidden rounded-[8px] text-white shadow-[0_30px_100px_rgba(18,40,47,0.24)] sm:min-h-[calc(100vh-32px)]">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#137f91]">
              <Compass size={19} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/68">AI travel companion</p>
              <p className="text-lg font-semibold">Travel Stylist</p>
            </div>
          </div>
          <p className="hidden text-sm font-semibold text-white/72 sm:block">Plan. Dress. Belong.</p>
        </header>

        <div className="flex flex-1 flex-col justify-between px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-[650px] pt-[8vh] sm:pt-[10vh]"
          >
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-[#d9f4f2]">Go beyond the guidebook</p>
            <h1 className="font-serif text-5xl leading-[0.94] drop-shadow-sm sm:text-7xl lg:text-[82px]">
              Go farther.
              <br />
              Feel local.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/82 sm:text-lg">
              A smarter way to discover a place, dress for it, and arrive already in rhythm.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Vibe check: alive", "Tourist mode: off", "Outfit drama: optional"].map((label) => (
                <span key={label} className="rounded-full border border-white/22 bg-white/14 px-3 py-1.5 text-xs font-bold text-white/88 backdrop-blur-md">
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="welcome-dock mt-10 grid overflow-hidden rounded-[8px] border border-white/70 bg-[#fffaf0]/95 text-[#10292e] shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            {signals.map(({ label, detail, Icon }) => (
              <div key={label} className="flex min-h-[86px] items-center gap-3 border-b border-[#173239]/12 bg-[#fffdf8]/92 px-4 py-4 md:border-b-0 md:border-r">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d6eeea] text-[#08716e] shadow-[0_10px_25px_rgba(8,113,110,0.16)]">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-black text-[#0b2228]">{label}</p>
                  <p className="mt-1 text-xs font-bold text-[#415a60]">{detail}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center bg-[#f4efe4]/95 p-3">
              <button
                type="button"
                onClick={onExplore}
                className="flex h-14 w-full min-w-[210px] items-center justify-between rounded-full bg-[#147f93] pl-5 pr-2 font-bold text-white shadow-[0_12px_30px_rgba(20,127,147,0.28)] transition hover:bg-[#106f81] md:w-auto"
              >
                Start exploring
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#147f93]">
                  <ArrowRight size={19} />
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
