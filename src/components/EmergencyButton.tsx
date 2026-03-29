"use client";

import { useState } from "react";
import { getCurrentPosition, GURGAON_CENTER, estimateWalkingTime, formatDistance } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Toilet } from "@/lib/types";

interface EmergencyButtonProps {
  onFound: (toilet: Toilet, userLat: number, userLng: number) => void;
}

export default function EmergencyButton({ onFound }: EmergencyButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleEmergency() {
    setLoading(true);
    let lat = GURGAON_CENTER.lat;
    let lng = GURGAON_CENTER.lng;

    try {
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      toast.info("Using approximate location");
    }

    const { data, error } = await supabase.rpc("nearby_toilets", {
      user_lat: lat,
      user_lng: lng,
      radius_m: 5000,
    });

    setLoading(false);

    if (error || !data || data.length === 0) {
      toast.error("No toilets found within 5km");
      return;
    }

    const closest = data[0] as Toilet;
    toast.success(
      `Found! ${formatDistance(closest.distance_m ?? 0)} away · ${estimateWalkingTime(closest.distance_m ?? 0)}`
    );
    onFound(closest, lat, lng);
  }

  return (
    <div className="relative">
      <button
        onClick={handleEmergency}
        disabled={loading}
        className="w-14 h-14 bg-[#b61722] text-white rounded-full shadow-[0_8px_30px_rgb(182,23,34,0.4)] flex items-center justify-center text-2xl animate-emergency-pulse active:scale-95 transition-transform disabled:opacity-70"
        aria-label="Find nearest toilet urgently"
      >
        {loading ? (
          <span className="animate-spin text-xl">⏳</span>
        ) : (
          <span>🚨</span>
        )}
      </button>
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap pointer-events-none">
        <p className="text-[10px] font-bold text-[#b61722] uppercase tracking-tight">Nearest Flush</p>
      </div>
    </div>
  );
}
