/**
 * Seed script: fetches toilet data from OSM Overpass API for Gurgaon
 * and upserts into Supabase.
 *
 * Usage: npx tsx src/scripts/seed-osm.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * in .env.local or environment.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Overpass query for toilets in Gurugram area
const OVERPASS_QUERY = `
[out:json][timeout:30];
area["name"="Gurugram"]->.gurgaon;
(
  node["amenity"="toilets"](area.gurgaon);
  way["amenity"="toilets"](area.gurgaon);
);
out center;
`;

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Known Gurgaon toilets for fallback seeding
const MANUAL_SEEDS = [
  { lat: 28.5044, lng: 77.0940, name: "Ambience Mall Restroom", type: "mall" as const, is_free: true },
  { lat: 28.4949, lng: 77.0886, name: "CyberHub Public Restroom", type: "public" as const, is_free: true },
  { lat: 28.4594, lng: 77.0726, name: "HUDA City Centre Metro Toilet", type: "public" as const, is_free: true },
  { lat: 28.4619, lng: 77.0640, name: "Sector 29 Market Toilet", type: "public" as const, is_free: true },
  { lat: 28.4436, lng: 77.0520, name: "Sector 14 Market Public Toilet", type: "public" as const, is_free: true },
  { lat: 28.4134, lng: 77.0425, name: "Sector 56 HUDA Market Toilet", type: "public" as const, is_free: true },
  { lat: 28.4282, lng: 77.0432, name: "Sector 43 Rapid Metro Toilet", type: "public" as const, is_free: true },
  { lat: 28.4737, lng: 77.0397, name: "Sector 15 Part 2 Market Toilet", type: "public" as const, is_free: true },
  { lat: 28.4505, lng: 77.0685, name: "MG Road Metro Toilet", type: "public" as const, is_free: true },
  { lat: 28.4678, lng: 77.0835, name: "Sikanderpur Metro Toilet", type: "public" as const, is_free: true },
  { lat: 28.4953, lng: 77.0653, name: "Galleria Market Restroom (DLF Phase 4)", type: "mall" as const, is_free: true },
  { lat: 28.4816, lng: 77.1072, name: "South Point Mall Restroom", type: "mall" as const, is_free: true },
  { lat: 28.4683, lng: 77.0322, name: "Sector 17 Petrol Pump Toilet", type: "gas_station" as const, is_free: false, price_inr: 5 },
  { lat: 28.4279, lng: 77.0606, name: "Iffco Chowk Metro Toilet", type: "public" as const, is_free: true },
  { lat: 28.4462, lng: 77.0513, name: "Sadar Bazar Gurgaon Public Toilet", type: "public" as const, is_free: true },
  { lat: 28.4960, lng: 77.0386, name: "Udyog Vihar Phase 5 Toilet", type: "public" as const, is_free: true },
  { lat: 28.5131, lng: 77.0525, name: "Sector 18 Market Toilet", type: "public" as const, is_free: true },
  { lat: 28.4219, lng: 77.0410, name: "Sector 57 Golf Course Road Restroom", type: "restaurant" as const, is_free: true },
  { lat: 28.4110, lng: 77.0628, name: "Nirvana Country Toilet", type: "public" as const, is_free: true },
  { lat: 28.3905, lng: 77.0501, name: "Sector 67 Sulabh Toilet", type: "public" as const, is_free: false, price_inr: 5 },
];

function mapOsmTags(tags: Record<string, string> = {}) {
  const amenities: string[] = [];

  if (tags["toilets:seated"] === "yes" || tags["toilets:position"] === "seated") amenities.push("western");
  if (tags["toilets:squat"] === "yes" || tags["toilets:position"] === "squat") amenities.push("squat");
  if (tags["handwashing"] === "yes") amenities.push("soap");
  if (tags["wheelchair"] === "yes") amenities.push("wheelchair");
  if (tags["changing_table"] === "yes") amenities.push("baby_changing");
  if (tags["bidet"] === "yes") amenities.push("bidet");

  return {
    name: tags["name"] || null,
    is_free: tags["fee"] !== "yes",
    opening_hours: tags["opening_hours"] || null,
    type: "public" as const,
    amenities,
  };
}

async function seedFromOSM() {
  console.log("Fetching from Overpass API...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) {
    console.error("Overpass API error:", res.status);
    return 0;
  }

  const json = await res.json();
  const elements: OsmElement[] = json.elements || [];
  console.log(`Found ${elements.length} toilets from OSM`);

  let count = 0;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    const mapped = mapOsmTags(el.tags);

    const { data: toilet, error } = await supabase
      .from("toilets")
      .upsert(
        {
          location: `SRID=4326;POINT(${lon} ${lat})`,
          name: mapped.name,
          type: mapped.type,
          is_free: mapped.is_free,
          opening_hours: mapped.opening_hours,
          status: "active",
          osm_id: el.id,
        },
        { onConflict: "osm_id" }
      )
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to upsert OSM ID ${el.id}:`, error.message);
      continue;
    }

    if (toilet && mapped.amenities.length > 0) {
      await supabase.from("toilet_amenities").upsert(
        mapped.amenities.map((amenity) => ({ toilet_id: toilet.id, amenity })),
        { onConflict: "toilet_id,amenity" }
      );
    }
    count++;
  }

  return count;
}

async function seedManual() {
  console.log("Seeding manual locations...");
  let count = 0;

  for (const loc of MANUAL_SEEDS) {
    const { data: toilet, error } = await supabase
      .from("toilets")
      .insert({
        location: `SRID=4326;POINT(${loc.lng} ${loc.lat})`,
        name: loc.name,
        type: loc.type,
        is_free: loc.is_free,
        price_inr: "price_inr" in loc ? loc.price_inr : null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to insert ${loc.name}:`, error.message);
      continue;
    }

    // Add default amenities for manual seeds
    if (toilet) {
      const defaultAmenities = ["western", "soap"];
      if (loc.type === "mall") defaultAmenities.push("tissue", "hand_dryer");
      await supabase.from("toilet_amenities").insert(
        defaultAmenities.map((amenity) => ({ toilet_id: toilet.id, amenity }))
      );
    }
    count++;
  }

  return count;
}

async function main() {
  console.log("🚽 Flush — Seeding Gurgaon toilet data\n");

  const osmCount = await seedFromOSM();
  console.log(`\nInserted/updated ${osmCount} toilets from OSM`);

  if (osmCount < 10) {
    console.log("\nOSM data sparse, adding manual seeds...");
    const manualCount = await seedManual();
    console.log(`Inserted ${manualCount} manual locations`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
