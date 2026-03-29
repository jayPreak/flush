# Flush — Toilet Finder for Gurgaon (V1)

## What This Is
A mobile-first web app that helps people find nearby toilets with detailed amenity info and ratings — like Google Maps but specifically for toilets. Starting with Gurgaon, India.

**Name:** Flush
**Tagline:** "Find a toilet near you"

## Tech Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **UI Components:** shadcn/ui (Drawer via Vaul, Badge, Button, Card, Dialog, Toast via Sonner)
- **Map:** Leaflet + react-leaflet with CARTO Voyager tiles (free, no API key)
- **Database:** Supabase (Postgres + PostGIS for geo queries)
- **Deployment:** Vercel
- **Testing:** Playwright (mobile Chrome + Safari)
- **Data Seeding:** Script hitting Overpass API for Gurgaon `amenity=toilets`

## Project Structure
```
src/
  app/
    layout.tsx              # Root layout, mobile viewport meta, Toaster
    page.tsx                # Client component, dynamic imports Map with ssr:false
    globals.css             # Tailwind v4 + Leaflet CSS overrides
  components/
    Map.tsx                 # Core: Leaflet map, geolocation, toilet pins, debounced fetch
    ToiletPin.tsx           # Custom SVG marker (green=free, yellow=paid, pulse on highlight)
    ToiletDetail.tsx        # Bottom sheet (shadcn Drawer) with toilet info + reviews
    EmergencyButton.tsx     # "I need to go NOW" red FAB — finds closest within 5km
    AddToiletFlow.tsx       # 4-step form: location picker, details, amenities, summary
    ReviewForm.tsx          # Star rating + text review + honeypot
    AmenityTag.tsx          # Badge/toggle chip for amenity display
    StarRating.tsx          # Reusable star rating (display + interactive)
    ui/                     # shadcn/ui generated components
  lib/
    supabase.ts             # Supabase client (uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    types.ts                # TypeScript interfaces (Toilet, Review, AmenityType, etc.)
    amenities.ts            # 12 amenity types with labels and emoji icons
    geo.ts                  # Geolocation helpers, Haversine distance, walking time, sanitizeText
  scripts/
    seed-osm.ts             # Overpass API seeder + 20 manual Gurgaon fallback locations
supabase/
  schema.sql                # Full DB schema: tables, indexes, RPC, triggers, RLS
tests/
  app.spec.ts               # Playwright smoke tests
```

## Database Schema (Supabase + PostGIS)

### Tables
- **toilets** — `id` uuid, `location` geography(POINT,4326) with GiST index, `name`, `description`, `type` (public/restaurant/mall/gas_station/hotel), `is_free`, `price_inr`, `opening_hours`, `status` (active/closed/flagged), `avg_rating` (cached), `review_count` (cached), `osm_id` (unique, for dedup)
- **toilet_amenities** — `toilet_id` FK, `amenity` text from fixed set of 12 types
- **reviews** — `id` uuid, `toilet_id` FK, `rating` 1-5, `body` text, `created_at`

### RPC Function
`nearby_toilets(user_lat, user_lng, radius_m)` — returns toilets sorted by distance with amenities array. Clamps radius to 10km max.

### Triggers
- `update_toilet_stats` — on INSERT to reviews, recalculates `avg_rating` and `review_count` on parent toilet
- `update_updated_at` — auto-updates `updated_at` on toilet row changes

### RLS
V1 is anonymous: anyone can read and insert toilets, reviews, amenities. No auth.

## Key Technical Notes
- Leaflet crashes with SSR — page.tsx is `"use client"` and uses `next/dynamic` with `ssr: false`
- PostGIS uses `geography` type (meters, Earth curvature) not `geometry`
- `ST_Point(lng, lat)` — longitude first, latitude second
- Insert location as WKT: `SRID=4326;POINT(77.0266 28.4595)`
- Supabase env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not anon key)
- Map tiles are CARTO Voyager (not default OSM tiles)
- Map refetch is debounced 500ms with 100m move threshold

## NPM Scripts
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run seed` — seed Gurgaon toilet data from OSM + manual fallbacks
- `npm test` — run Playwright tests
- `npm run test:ui` — Playwright UI mode

## Anti-abuse (V1)
- Radius clamped to 10km in RPC function
- Text inputs sanitized (HTML/script stripped) via `sanitizeText()`
- Honeypot field in AddToiletFlow and ReviewForm
- Rate limiting via `created_at` checks planned

## Verification Checklist
1. Map loads centered on user location (or Gurgaon fallback)
2. Toilet pins visible from seeded data (green=free, yellow=paid)
3. Tap pin → bottom sheet with details, amenities, reviews
4. "🚨" button → flies to closest toilet with walking time
5. "+" button → 4-step add toilet flow → new pin appears
6. Write a review → rating updates
7. Location denied → falls back to Gurgaon center with banner
