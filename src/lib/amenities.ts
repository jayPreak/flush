import type { AmenityType } from "./types";

export const AMENITY_META: Record<AmenityType, { label: string; icon: string }> = {
  western: { label: "Western", icon: "🚽" },
  squat: { label: "Squat", icon: "🧎" },
  japanese: { label: "Japanese", icon: "🇯🇵" },
  bidet: { label: "Bidet", icon: "💦" },
  spray_jet: { label: "Spray Jet", icon: "🚿" },
  urinal_only: { label: "Urinal Only", icon: "🚹" },
  soap: { label: "Soap", icon: "🧼" },
  tissue: { label: "Tissue", icon: "🧻" },
  hand_dryer: { label: "Hand Dryer", icon: "💨" },
  luggage_space: { label: "Luggage Space", icon: "🧳" },
  wheelchair: { label: "Wheelchair", icon: "♿" },
  baby_changing: { label: "Baby Changing", icon: "👶" },
};

export const ALL_AMENITIES = Object.keys(AMENITY_META) as AmenityType[];
