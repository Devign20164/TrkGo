-- Create enum for driver status
CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Create enum for trip type
CREATE TYPE public.trip_type AS ENUM ('village', 'outbound');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'customer');

-- Create geofence table for Pilar Village boundaries
CREATE TABLE public.geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    polygon JSONB NOT NULL, -- Array of lat/lng coordinates
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create approved stations table
CREATE TABLE public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create drivers table
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL UNIQUE,
    toda_association TEXT NOT NULL,
    body_number TEXT NOT NULL,
    license_photo_url TEXT,
    toda_id_photo_url TEXT,
    tricycle_photo_url TEXT,
    status driver_status DEFAULT 'pending',
    is_online BOOLEAN DEFAULT false,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_phone TEXT,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    pickup_address TEXT,
    dropoff_latitude DOUBLE PRECISION NOT NULL,
    dropoff_longitude DOUBLE PRECISION NOT NULL,
    dropoff_address TEXT,
    station_id UUID REFERENCES public.stations(id),
    trip_type trip_type NOT NULL,
    fare DECIMAL(10,2) NOT NULL,
    driver_id UUID REFERENCES public.drivers(id),
    status booking_status DEFAULT 'pending',
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Create profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Geofences policies (public read, admin write)
CREATE POLICY "Anyone can view active geofences" ON public.geofences
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage geofences" ON public.geofences
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stations policies (public read, admin write)
CREATE POLICY "Anyone can view active stations" ON public.stations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage stations" ON public.stations
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Drivers policies
CREATE POLICY "Anyone can view approved drivers" ON public.drivers
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Anyone can register as driver" ON public.drivers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Drivers can update their own profile" ON public.drivers
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all drivers" ON public.drivers
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Bookings policies
CREATE POLICY "Anyone can create bookings" ON public.bookings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view their own bookings" ON public.bookings
    FOR SELECT USING (true);

CREATE POLICY "Drivers can update assigned bookings" ON public.bookings
    FOR UPDATE USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all bookings" ON public.bookings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;

-- Insert default Pilar Village geofence (approximate polygon)
INSERT INTO public.geofences (name, polygon) VALUES (
    'Pilar Village',
    '[
        {"lat": 14.4285, "lng": 120.9845},
        {"lat": 14.4285, "lng": 120.9925},
        {"lat": 14.4225, "lng": 120.9925},
        {"lat": 14.4225, "lng": 120.9845}
    ]'::jsonb
);

-- Insert default approved stations
INSERT INTO public.stations (name, latitude, longitude) VALUES
    ('SM Southmall', 14.4214, 120.9830),
    ('Royal South', 14.4180, 120.9850),
    ('Alabang-Zapote Junction', 14.4150, 120.9890);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_geofences_updated_at BEFORE UPDATE ON public.geofences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON public.stations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();