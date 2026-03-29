"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import ToiletPin from "./ToiletPin";
import ToiletDetail from "./ToiletDetail";
import EmergencyButton from "./EmergencyButton";
import AddToiletFlow from "./AddToiletFlow";
import { supabase } from "@/lib/supabase";
import { getCurrentPosition, GURGAON_CENTER, distanceBetween } from "@/lib/geo";
import { toast } from "sonner";
import type { Toilet } from "@/lib/types";

const USER_ICON = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:32px;height:32px;background:rgba(59,130,246,0.3);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
    <div style="width:16px;height:16px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;z-index:1"></div>
  </div>
  <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
});

function MapEvents({
  onMoveEnd,
}: {
  onMoveEnd: (lat: number, lng: number, radius: number) => void;
}) {
  const map = useMap();
  const lastCenter = useRef({ lat: 0, lng: 0 });
  const hasFiredInitial = useRef(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function doFetch() {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const radius = Math.min(
        center.distanceTo(bounds.getNorthEast()),
        10000
      );
      lastCenter.current = { lat: center.lat, lng: center.lng };
      onMoveEnd(center.lat, center.lng, radius);
    }

    function handleMoveEnd() {
      const center = map.getCenter();
      const moved = distanceBetween(
        lastCenter.current.lat,
        lastCenter.current.lng,
        center.lat,
        center.lng
      );
      if (moved < 100 && lastCenter.current.lat !== 0) return;

      clearTimeout(timeout);
      timeout = setTimeout(doFetch, 500);
    }

    // Fire immediately on first mount — no debounce
    if (!hasFiredInitial.current) {
      hasFiredInitial.current = true;
      doFetch();
    }

    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("moveend", handleMoveEnd);
      clearTimeout(timeout);
    };
  }, [map, onMoveEnd]);

  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 17, { duration: 1 });
  }, [map, lat, lng]);
  return null;
}

export default function Map() {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState(GURGAON_CENTER);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [geoPermissionDenied, setGeoPermissionDenied] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "add" | "reviews" | "profile">("map");

  // Check if permission was already granted/denied — skip the prompt if so
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (result.state === "granted") {
        setShowLocationPrompt(false);
        getCurrentPosition().then((pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPos(loc);
          setFlyTarget(loc);
        });
      } else if (result.state === "denied") {
        setShowLocationPrompt(false);
        setGeoPermissionDenied(true);
      }
    });
  }, []);

  function requestLocation() {
    setShowLocationPrompt(false);
    getCurrentPosition()
      .then((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(loc);
        setFlyTarget(loc);
      })
      .catch(() => {
        setGeoPermissionDenied(true);
      });
  }

  function skipLocation() {
    setShowLocationPrompt(false);
  }

  const fetchToilets = useCallback(
    async (lat: number, lng: number, radius: number) => {
      const { data, error } = await supabase.rpc("nearby_toilets", {
        user_lat: lat,
        user_lng: lng,
        radius_m: Math.min(radius, 10000),
      });
      if (error) {
        console.error("Failed to fetch toilets:", error);
        return;
      }
      if (data) setToilets(data as Toilet[]);
    },
    []
  );

  const markers = useMemo(
    () =>
      toilets.map((t) => (
        <ToiletPin
          key={t.id}
          toilet={t}
          highlight={t.id === highlightId}
          onClick={() => {
            (document.activeElement as HTMLElement)?.blur();
            setSelectedToilet(t);
          }}
        />
      )),
    [toilets, highlightId]
  );

  function handleEmergencyFound(toilet: Toilet, userLat: number, userLng: number) {
    setUserPos({ lat: userLat, lng: userLng });
    setHighlightId(toilet.id);
    setFlyTarget({ lat: toilet.lat, lng: toilet.lng });
    setSelectedToilet(toilet);
    setTimeout(() => setHighlightId(null), 5000);
  }

  return (
    <>
      {/* Location permission prompt */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-8 pb-10 shadow-[0_-8px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-300">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600" style={{ fontSize: 32 }}>my_location</span>
              </div>
              <h2 className="text-xl font-bold text-[#191c1e]">Find toilets near you</h2>
              <p className="text-sm text-[#6d7b6c] leading-relaxed">
                Enable location access so we can show you the closest toilets and walking directions.
              </p>
              <button
                onClick={requestLocation}
                className="w-full bg-gradient-to-br from-[#006e2f] to-[#22c55e] text-white py-4 rounded-2xl font-bold text-base shadow-md active:scale-[0.98] transition-transform mt-2"
              >
                Enable Location
              </button>
              <button
                onClick={skipLocation}
                className="text-sm text-[#6d7b6c] font-medium py-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location denied banner */}
      {geoPermissionDenied && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[#d7a400] text-white py-1 px-4 text-center text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[14px]">location_off</span>
          Location access denied. Showing Gurgaon area.
        </div>
      )}

      {/* Top App Bar */}
      <header className={`fixed ${geoPermissionDenied ? "top-6" : "top-0"} w-full z-50 bg-white/85 backdrop-blur-md shadow-sm`}>
        <div className="flex items-center justify-between px-6 h-16 w-full">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600" style={{ fontSize: 24 }}>wc</span>
            <h1 className="font-black text-xl tracking-tight text-green-700 italic">Flush</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-zinc-100 transition-colors text-zinc-500">
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>
        </div>
      </header>

      {/* Map Canvas — z-0 keeps Leaflet's internal z-indexes below fixed overlays (drawer z-50) */}
      <div className={`absolute inset-0 z-0 ${geoPermissionDenied ? "pt-[88px]" : "pt-16"}`}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={15}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapEvents onMoveEnd={fetchToilets} />
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={USER_ICON} />}
          {markers}
        </MapContainer>
      </div>

      {/* Emergency FAB */}
      <div className="fixed bottom-28 right-6 z-40">
        <EmergencyButton onFound={handleEmergencyFound} />
      </div>

      {/* Add Facility FAB */}
      <div className="fixed bottom-28 left-6 z-40">
        <button
          onClick={() => setShowAddFlow(true)}
          className="w-14 h-14 bg-[#22c55e] text-white rounded-full shadow-[0_8px_30px_rgb(34,197,94,0.4)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Add a toilet"
        >
          <span className="material-symbols-outlined text-3xl font-bold">add</span>
        </button>
      </div>

      {/* Location Status Card */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md">
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-white/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f2f4f6] rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[#6d7b6c]">explore</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#6d7b6c] uppercase tracking-widest">Current View</p>
              <p className="text-sm font-bold text-[#191c1e]">
                {geoPermissionDenied ? "Sector 29, Gurgaon" : "Your Location"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full rounded-t-3xl z-50 bg-white shadow-[0_-4px_20px_0_rgba(0,0,0,0.05)] border-t-0 bg-[#f2f4f6]">
        <div className="flex justify-around items-center h-20 px-4 pb-2 w-full">
          {/* Map */}
          <button
            onClick={() => setActiveTab("map")}
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === "map"
                ? "bg-green-100 text-green-800"
                : "text-zinc-400 hover:text-green-600"
            }`}
          >
            <span className="material-symbols-outlined" style={activeTab === "map" ? { fontVariationSettings: "'FILL' 1" } : {}}>map</span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Map</span>
          </button>
          {/* Add */}
          <button
            onClick={() => setShowAddFlow(true)}
            className="flex flex-col items-center justify-center text-zinc-400 px-3 py-1.5 transition-all duration-300 ease-out active:scale-90 hover:text-green-600"
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Add</span>
          </button>
          {/* Reviews */}
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === "reviews"
                ? "bg-green-100 text-green-800"
                : "text-zinc-400 hover:text-green-600"
            }`}
          >
            <span className="material-symbols-outlined">rate_review</span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Reviews</span>
          </button>
          {/* Profile */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-all duration-300 ease-out active:scale-90 ${
              activeTab === "profile"
                ? "bg-green-100 text-green-800"
                : "text-zinc-400 hover:text-green-600"
            }`}
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Profile</span>
          </button>
        </div>
      </nav>

      {/* Toilet detail bottom sheet */}
      <ToiletDetail
        toilet={selectedToilet}
        userLat={userPos?.lat ?? null}
        userLng={userPos?.lng ?? null}
        onClose={() => setSelectedToilet(null)}
      />

      {/* Add toilet flow */}
      {showAddFlow && (
        <AddToiletFlow
          initialLat={userPos?.lat ?? center.lat}
          initialLng={userPos?.lng ?? center.lng}
          onClose={() => setShowAddFlow(false)}
          onAdded={() => fetchToilets(center.lat, center.lng, 5000)}
        />
      )}
    </>
  );
}
