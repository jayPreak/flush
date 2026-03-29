-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Toilets table
CREATE TABLE IF NOT EXISTS toilets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location geography(POINT, 4326) NOT NULL,
  name text,
  description text,
  type text NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'restaurant', 'mall', 'gas_station', 'hotel')),
  is_free boolean NOT NULL DEFAULT true,
  price_inr integer,
  opening_hours text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'flagged')),
  avg_rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  osm_id bigint UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GiST index for spatial queries
CREATE INDEX IF NOT EXISTS idx_toilets_location ON toilets USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_toilets_status ON toilets (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_toilets_updated_at
  BEFORE UPDATE ON toilets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Toilet amenities table
CREATE TABLE IF NOT EXISTS toilet_amenities (
  toilet_id uuid NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  amenity text NOT NULL CHECK (amenity IN (
    'western', 'squat', 'japanese', 'bidet', 'spray_jet', 'urinal_only',
    'soap', 'tissue', 'hand_dryer', 'luggage_space', 'wheelchair', 'baby_changing'
  )),
  PRIMARY KEY (toilet_id, amenity)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id uuid NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_toilet_id ON reviews (toilet_id);

-- Trigger: update toilet stats on review insert
CREATE OR REPLACE FUNCTION update_toilet_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE toilets SET
    avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE toilet_id = NEW.toilet_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE toilet_id = NEW.toilet_id)
  WHERE id = NEW.toilet_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_toilet_stats
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_toilet_stats();

-- RPC: nearby_toilets
CREATE OR REPLACE FUNCTION nearby_toilets(
  user_lat double precision,
  user_lng double precision,
  radius_m double precision DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  lat double precision,
  lng double precision,
  name text,
  description text,
  type text,
  is_free boolean,
  price_inr integer,
  opening_hours text,
  status text,
  avg_rating numeric,
  review_count integer,
  osm_id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  amenities text[],
  distance_m double precision
) AS $$
DECLARE
  clamped_radius double precision;
BEGIN
  -- Clamp radius to 10km max
  clamped_radius := LEAST(radius_m, 10000);

  RETURN QUERY
  SELECT
    t.id,
    ST_Y(t.location::geometry) AS lat,
    ST_X(t.location::geometry) AS lng,
    t.name,
    t.description,
    t.type,
    t.is_free,
    t.price_inr,
    t.opening_hours,
    t.status,
    t.avg_rating,
    t.review_count,
    t.osm_id,
    t.created_at,
    t.updated_at,
    COALESCE(
      ARRAY(SELECT ta.amenity FROM toilet_amenities ta WHERE ta.toilet_id = t.id),
      '{}'::text[]
    ) AS amenities,
    ST_Distance(t.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS distance_m
  FROM toilets t
  WHERE t.status = 'active'
    AND ST_DWithin(
      t.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      clamped_radius
    )
  ORDER BY distance_m ASC;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (anonymous access for V1)
ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE toilet_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "Anyone can read toilets" ON toilets FOR SELECT USING (true);
CREATE POLICY "Anyone can read amenities" ON toilet_amenities FOR SELECT USING (true);
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);

-- Allow anyone to insert
CREATE POLICY "Anyone can add toilets" ON toilets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can add amenities" ON toilet_amenities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can add reviews" ON reviews FOR INSERT WITH CHECK (true);
