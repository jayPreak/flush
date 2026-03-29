"use client";

import { Marker } from "react-leaflet";
import L from "leaflet";
import type { Toilet } from "@/lib/types";

interface ToiletPinProps {
  toilet: Toilet;
  highlight?: boolean;
  onClick: () => void;
}

function createIcon(isFree: boolean, highlight: boolean, priceInr: number | null) {
  const bgColor = isFree ? "#22c55e" : "#d7a400";
  const scale = highlight ? 1.15 : 1;
  const badgeText = isFree ? "FREE" : `₹${priceInr ?? "?"}`;
  const badgeBg = isFree ? "#006e2f" : "white";
  const badgeColor = isFree ? "white" : "#191c1e";

  const pulse = highlight
    ? `<div style="position:absolute;inset:-8px;border-radius:16px;background:${bgColor};opacity:0.3;animation:pin-pulse 1.5s ease-out infinite"></div>
       <style>@keyframes pin-pulse{0%{transform:scale(1);opacity:0.3}100%{transform:scale(1.8);opacity:0}}</style>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [48, 58],
    iconAnchor: [24, 29],
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:scale(${scale});transition:transform 0.2s">
      <div style="position:relative">
        ${pulse}
        <div style="background:${bgColor};width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:2px solid white;position:relative;z-index:1;cursor:pointer">
          <span style="font-size:18px;line-height:1">🚻</span>
        </div>
      </div>
      <div style="background:${badgeBg};padding:1px 6px;margin-top:2px;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,0.1)">
        <span style="font-size:9px;font-weight:700;color:${badgeColor};letter-spacing:0.02em">${badgeText}</span>
      </div>
    </div>`,
  });
}

export default function ToiletPin({ toilet, highlight = false, onClick }: ToiletPinProps) {
  return (
    <Marker
      position={[toilet.lat, toilet.lng]}
      icon={createIcon(toilet.is_free, highlight, toilet.price_inr)}
      eventHandlers={{ click: onClick }}
    />
  );
}
