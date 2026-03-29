"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AmenityTag from "./AmenityTag";
import { ALL_AMENITIES } from "@/lib/amenities";
import { supabase } from "@/lib/supabase";
import { sanitizeText } from "@/lib/geo";
import { toast } from "sonner";
import type { ToiletType, AmenityType } from "@/lib/types";

interface AddToiletFlowProps {
  initialLat: number;
  initialLng: number;
  onClose: () => void;
  onAdded: () => void;
}

const TOILET_TYPES: { value: ToiletType; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "restaurant", label: "Restaurant" },
  { value: "mall", label: "Mall" },
  { value: "gas_station", label: "Gas Station" },
  { value: "hotel", label: "Hotel" },
];

export default function AddToiletFlow({
  initialLat,
  initialLng,
  onClose,
  onAdded,
}: AddToiletFlowProps) {
  const [step, setStep] = useState(1);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [areaName, setAreaName] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ToiletType>("public");
  const [isFree, setIsFree] = useState(true);
  const [priceInr, setPriceInr] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [amenities, setAmenities] = useState<Set<AmenityType>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`
      );
      const data = await res.json();
      if (data.display_name) {
        const parts = data.display_name.split(",").slice(0, 3);
        setAreaName(parts.join(",").trim());
      }
    } catch {
      setAreaName("");
    }
  }, []);

  useEffect(() => {
    if (step !== 1 || !mapRef.current) return;

    let map: L.Map;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }

      map = L.map(mapRef.current!, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);

      map.on("moveend", () => {
        const center = map.getCenter();
        setLat(center.lat);
        setLng(center.lng);
        reverseGeocode(center.lat, center.lng);
      });

      leafletMapRef.current = map;
      reverseGeocode(lat, lng);
    }

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function toggleAmenity(a: AmenityType) {
    setAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function handleSubmit() {
    if (honeypot) return;
    setSubmitting(true);

    const { data: toilet, error } = await supabase
      .from("toilets")
      .insert({
        location: `SRID=4326;POINT(${lng} ${lat})`,
        name: name.trim() ? sanitizeText(name) : null,
        type,
        is_free: isFree,
        price_inr: isFree ? null : parseInt(priceInr) || null,
        opening_hours: openingHours.trim() ? sanitizeText(openingHours) : null,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !toilet) {
      toast.error("Failed to add toilet");
      setSubmitting(false);
      return;
    }

    if (amenities.size > 0) {
      const rows = Array.from(amenities).map((amenity) => ({
        toilet_id: toilet.id,
        amenity,
      }));
      await supabase.from("toilet_amenities").insert(rows);
    }

    toast.success("Toilet added! Thanks for contributing.");
    setSubmitting(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 bg-white z-10">
        <h1 className="text-xl font-black tracking-tight text-[#191c1e]">Add a Toilet</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-[#3d4a3d] bg-[#e6e8ea] px-2 py-1 rounded-lg uppercase">
            Step {step}/4
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f2f4f6] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-[#f2f4f6]">
        <div
          className="h-full bg-[#22c55e] rounded-full transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Honeypot */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px]"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="flex-1 overflow-y-auto">
        {/* Step 1: Location */}
        {step === 1 && (
          <div className="flex flex-col h-full">
            <div className="relative flex-1" ref={mapRef}>
              {/* Crosshair overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-[#b61722] rounded-xl flex items-center justify-center shadow-xl border-2 border-white">
                    <span className="text-lg">🚻</span>
                  </div>
                  <div className="w-0.5 h-4 bg-[#b61722]" />
                </div>
              </div>
            </div>
            {areaName && (
              <div className="px-6 py-3 text-sm text-[#3d4a3d] text-center bg-[#f2f4f6]/50 font-medium">
                <span className="material-symbols-outlined text-[16px] mr-1 align-middle">location_on</span>
                {areaName}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="px-6 py-8 space-y-10">
            {/* Name */}
            <section className="space-y-3">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#3d4a3d]">
                Name of Facility
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ambience Mall Restroom"
                maxLength={200}
                className="w-full h-14 px-5 bg-[#f2f4f6] border-none rounded-xl focus:ring-2 focus:ring-[#22c55e]/20 text-[#191c1e] placeholder:text-[#6d7b6c]/50 transition-all"
              />
            </section>

            {/* Type */}
            <section className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#3d4a3d]">
                Facility Type
              </label>
              <div className="flex flex-wrap gap-2">
                {TOILET_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${
                      type === t.value
                        ? "bg-[#22c55e] text-white shadow-sm"
                        : "bg-[#f2f4f6] text-[#3d4a3d] hover:bg-[#e6e8ea]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Cost */}
            <section className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#3d4a3d]">
                Access Cost
              </label>
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#f2f4f6] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setIsFree(true)}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl font-bold uppercase tracking-widest transition-colors ${
                    isFree
                      ? "bg-white text-[#006e2f] shadow-sm"
                      : "text-[#3d4a3d] hover:bg-[#e6e8ea]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">money_off</span>
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setIsFree(false)}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl font-bold uppercase tracking-widest transition-colors ${
                    !isFree
                      ? "bg-white text-[#785a00] shadow-sm"
                      : "text-[#3d4a3d] hover:bg-[#e6e8ea]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Paid
                </button>
              </div>
              {!isFree && (
                <input
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value.replace(/\D/g, ""))}
                  placeholder="Price in ₹"
                  className="w-32 h-14 px-5 bg-[#f2f4f6] border-none rounded-xl focus:ring-2 focus:ring-[#22c55e]/20 text-[#191c1e] placeholder:text-[#6d7b6c]/50"
                />
              )}
            </section>

            {/* Hours */}
            <section className="space-y-3">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#3d4a3d]">
                Operating Hours
              </label>
              <input
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="e.g. 24/7"
                maxLength={100}
                className="w-full h-14 px-5 bg-[#f2f4f6] border-none rounded-xl focus:ring-2 focus:ring-[#22c55e]/20 text-[#191c1e] placeholder:text-[#6d7b6c]/50 transition-all"
              />
            </section>
          </div>
        )}

        {/* Step 3: Amenities */}
        {step === 3 && (
          <div className="px-6 py-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#3d4a3d] mb-4">
              Select all that apply
            </h3>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map((a) => (
                <AmenityTag
                  key={a}
                  amenity={a}
                  interactive
                  selected={amenities.has(a)}
                  onToggle={() => toggleAmenity(a)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="px-6 py-8 space-y-6">
            <h3 className="text-lg font-bold text-[#191c1e]">Confirm Details</h3>
            <div className="space-y-4">
              <div className="bg-[#f2f4f6] p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#6d7b6c]">location_on</span>
                  <span className="text-sm text-[#191c1e] font-medium">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                    {areaName && ` — ${areaName}`}
                  </span>
                </div>
                {name && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#6d7b6c]">badge</span>
                    <span className="text-sm text-[#191c1e] font-medium">{name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#6d7b6c]">category</span>
                  <span className="text-sm text-[#191c1e] font-medium capitalize">{type.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#6d7b6c]">payments</span>
                  <span className="text-sm text-[#191c1e] font-medium">
                    {isFree ? "Free" : `₹${priceInr || "?"}`}
                  </span>
                </div>
                {openingHours && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#6d7b6c]">schedule</span>
                    <span className="text-sm text-[#191c1e] font-medium">{openingHours}</span>
                  </div>
                )}
              </div>
              {amenities.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(amenities).map((a) => (
                    <AmenityTag key={a} amenity={a} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <footer className="px-6 py-6 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.03)] flex gap-4">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 h-14 rounded-xl border-2 border-[#22c55e] font-black tracking-tight text-[#22c55e] hover:bg-[#22c55e]/5 transition-all active:scale-95"
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex-[2] h-14 rounded-xl bg-[#22c55e] font-black tracking-tight text-white shadow-lg shadow-[#22c55e]/20 hover:bg-[#006e2f] transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Next
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] h-14 rounded-xl bg-[#22c55e] font-black tracking-tight text-white shadow-lg shadow-[#22c55e]/20 hover:bg-[#006e2f] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? "Adding..." : "Add Toilet"}
            <span className="material-symbols-outlined">check</span>
          </button>
        )}
      </footer>
    </div>
  );
}
