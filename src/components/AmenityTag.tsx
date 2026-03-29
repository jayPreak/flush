"use client";

import { AMENITY_META } from "@/lib/amenities";
import type { AmenityType } from "@/lib/types";

interface AmenityTagProps {
  amenity: AmenityType;
  interactive?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export default function AmenityTag({
  amenity,
  interactive = false,
  selected = false,
  onToggle,
}: AmenityTagProps) {
  const meta = AMENITY_META[amenity];
  if (!meta) return null;

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-colors ${
          selected
            ? "bg-[#22c55e]/20 text-[#004b1e] ring-2 ring-[#22c55e]"
            : "bg-[#f2f4f6] text-[#3d4a3d] hover:bg-[#e6e8ea]"
        }`}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-[#f2f4f6] px-3 py-2 rounded-xl text-[12px] font-medium">
      <span>{meta.icon}</span>
      <span className="text-[#3d4a3d]">{meta.label}</span>
    </div>
  );
}
