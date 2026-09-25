-- Enable PostGIS for Spatial features (Uber-style matching and tracking)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create a Driver Status table to track online drivers and their exact coordinates
CREATE TABLE IF NOT EXISTS public.driver_locations (
    driver_id UUID REFERENCES public.users(id) PRIMARY KEY,
    location geography(POINT, 4326), -- PostGIS Point (longitude, latitude)
    heading DECIMAL, -- Direction the car is facing
    speed DECIMAL, 
    status VARCHAR(20) DEFAULT 'ONLINE', -- ONLINE, BUSY, OFFLINE
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for live tracking on the map
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- 2. Ride Requests Table (On-Demand Uber Style)
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.users(id),
    driver_id UUID REFERENCES public.users(id), -- Null until a driver accepts
    pickup_location geography(POINT, 4326),
    pickup_address TEXT,
    dropoff_location geography(POINT, 4326),
    dropoff_address TEXT,
    status VARCHAR(30) DEFAULT 'SEARCHING', -- SEARCHING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
    estimated_fare DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;

-- 3. Function to find nearby drivers (Uber matching algorithm)
CREATE OR REPLACE FUNCTION find_nearby_drivers(pickup_lon FLOAT, pickup_lat FLOAT, radius_meters FLOAT)
RETURNS TABLE (
    driver_id UUID,
    distance_meters FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.driver_id,
        ST_Distance(d.location, ST_SetSRID(ST_MakePoint(pickup_lon, pickup_lat), 4326)) AS distance_meters
    FROM public.driver_locations d
    WHERE d.status = 'ONLINE'
    AND ST_DWithin(
        d.location, 
        ST_SetSRID(ST_MakePoint(pickup_lon, pickup_lat), 4326), 
        radius_meters
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Set up RLS for these tables
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read for driver locations so riders can see cars on the map
DROP POLICY IF EXISTS "Anyone can see online drivers" ON public.driver_locations;
CREATE POLICY "Anyone can see online drivers" ON public.driver_locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can update their own location" ON public.driver_locations;
CREATE POLICY "Drivers can update their own location" ON public.driver_locations FOR ALL USING (auth.uid() = driver_id);

-- Ride requests RLS
DROP POLICY IF EXISTS "Users can view their own ride requests" ON public.ride_requests;
CREATE POLICY "Users can view their own ride requests" ON public.ride_requests FOR SELECT USING (auth.uid() = rider_id OR auth.uid() = driver_id);

DROP POLICY IF EXISTS "Riders can create requests" ON public.ride_requests;
CREATE POLICY "Riders can create requests" ON public.ride_requests FOR INSERT WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Drivers and Riders can update requests" ON public.ride_requests;
CREATE POLICY "Drivers and Riders can update requests" ON public.ride_requests FOR UPDATE USING (auth.uid() = rider_id OR auth.uid() = driver_id);
