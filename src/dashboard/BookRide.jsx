
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiRequest } from "../services/api";

// Fix Leaflet marker icons when used with Vite.
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER = [22.9734, 78.6569];

async function searchAddress(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "in",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Location search failed. Please try again.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error("No matching location found.");
  }

  return {
    address: results[0].display_name,
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
  };
}

async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Could not retrieve this location's address.");
  }

  const result = await response.json();

  return result.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function MapController({ position, onMapSelect, onMapReady }) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 15, {
        duration: 0.7,
      });
    }
  }, [map, position]);

  useMapEvents({
    click(event) {
      onMapSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function BookRide() {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [pickupQuery, setPickupQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");

  const [selecting, setSelecting] = useState("pickup");
  const [mapInstance, setMapInstance] = useState(null);

  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searching, setSearching] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [ride, setRide] = useState(null);

  function updateLocation(type, location) {
    if (type === "pickup") {
      setPickup(location);
      setPickupQuery(location.address);
    } else {
      setDestination(location);
      setDestinationQuery(location.address);
    }

    setEstimate(null);
    setRide(null);
  }

  async function setLocationFromCoordinates(
    lat,
    lng,
    type = selecting
  ) {
    setError("");
    setNotice("Finding address...");

    try {
      const address = await reverseGeocode(lat, lng);

      updateLocation(type, {
        address,
        lat,
        lng,
      });

      setNotice(
        type === "pickup"
          ? "Pickup location selected."
          : "Destination selected."
      );
    } catch (err) {
      setError(err.message || "Could not find the address.");

      // Coordinates can still be used if reverse geocoding fails.
      updateLocation(type, {
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      });

      setNotice("");
    }
  }

  async function handleSearch(type) {
    const query =
      type === "pickup"
        ? pickupQuery.trim()
        : destinationQuery.trim();

    if (!query) {
      setError(
        type === "pickup"
          ? "Enter a pickup location to search."
          : "Enter a destination to search."
      );
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");

    try {
      const result = await searchAddress(query);

      updateLocation(type, result);
      setSelecting(type);
      setNotice(
        type === "pickup"
          ? "Pickup found. You can adjust it on the map."
          : "Destination found. You can adjust it on the map."
      );

      mapInstance?.flyTo([result.lat, result.lng], 15);
    } catch (err) {
      setError(err.message || "Unable to search for this location.");
    } finally {
      setSearching(false);
    }
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoadingLocation(true);
    setError("");
    setNotice("Requesting your current location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          await setLocationFromCoordinates(
            latitude,
            longitude,
            "pickup"
          );

          setSelecting("pickup");
          mapInstance?.flyTo([latitude, longitude], 16);
        } finally {
          setLoadingLocation(false);
        }
      },
      (geoError) => {
        const message =
          geoError.code === 1
            ? "Location permission was denied. Allow location access in your browser settings."
            : geoError.code === 2
              ? "Your current location is unavailable."
              : "Location request timed out. Please try again.";

        setError(message);
        setNotice("");
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }

  async function handleMapSelect(lat, lng) {
    await setLocationFromCoordinates(lat, lng, selecting);
  }

  async function handleEstimate() {
    if (!pickup || !destination) {
      setError("Please select both pickup and destination locations.");
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please sign in before estimating your fare.");
      return;
    }

    setEstimating(true);
    setError("");
    setNotice("");
    setEstimate(null);
    setRide(null);

    try {
      const result = await apiRequest("/api/rides/estimate", {
        method: "POST",
        token,
        body: {
          pickup_address: pickup.address,
          dropoff_address: destination.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: destination.lat,
          dropoff_lng: destination.lng,
        },
      });

      setEstimate(result);
      setNotice("Fare estimate calculated successfully.");
    } catch (err) {
      setError(err.message || "Unable to estimate the fare.");
    } finally {
      setEstimating(false);
    }
  }

  async function handleRequestRide() {
    if (!pickup || !destination) {
      setError("Please select both pickup and destination locations.");
      return;
    }

    if (
      pickup.lat === destination.lat &&
      pickup.lng === destination.lng
    ) {
      setError("Pickup and destination must be different locations.");
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please sign in before requesting a ride.");
      return;
    }

    setRequesting(true);
    setError("");
    setNotice("");
    setRide(null);

    try {
      const result = await apiRequest("/api/rides/request", {
        method: "POST",
        token,
        body: {
          pickup_address: pickup.address,
          dropoff_address: destination.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: destination.lat,
          dropoff_lng: destination.lng,
        },
      });

      setRide(result);
      setNotice("Your ride request was created successfully.");
    } catch (err) {
      setError(err.message || "Unable to request your ride.");
    } finally {
      setRequesting(false);
    }
  }

  const mapCenter = pickup
    ? [pickup.lat, pickup.lng]
    : destination
      ? [destination.lat, destination.lng]
      : DEFAULT_CENTER;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
            CabGo rides
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Where are you going?
          </h1>
          <p className="mt-3 text-slate-400">
            Search for a location, use your current location, or select a
            point directly on the map.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <button
                type="button"
                onClick={handleCurrentLocation}
                disabled={loadingLocation}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {loadingLocation
                  ? "Finding your location..."
                  : "◎ Use my current location"}
              </button>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Your browser will ask permission to access your location.
                Location access generally requires HTTPS or localhost.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="pickup-search"
                  className="font-bold text-white"
                >
                  <span className="mr-2 text-emerald-400">●</span>
                  Pickup location
                </label>

                <button
                  type="button"
                  onClick={() => setSelecting("pickup")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    selecting === "pickup"
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Select on map
                </button>
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearch("pickup");
                }}
              >
                <input
                  id="pickup-search"
                  value={pickupQuery}
                  onChange={(event) => setPickupQuery(event.target.value)}
                  placeholder="Search pickup address or place"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-amber-400"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl border border-slate-700 px-3 text-sm font-bold hover:border-amber-400 disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              {pickup && (
                <div className="mt-3 rounded-xl bg-slate-950 p-3">
                  <p className="break-words text-sm text-slate-300">
                    {pickup.address}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {pickup.lat.toFixed(6)}, {pickup.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="destination-search"
                  className="font-bold text-white"
                >
                  <span className="mr-2 text-rose-400">●</span>
                  Destination
                </label>

                <button
                  type="button"
                  onClick={() => setSelecting("destination")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    selecting === "destination"
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Select on map
                </button>
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearch("destination");
                }}
              >
                <input
                  id="destination-search"
                  value={destinationQuery}
                  onChange={(event) =>
                    setDestinationQuery(event.target.value)
                  }
                  placeholder="Search destination address or place"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-amber-400"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl border border-slate-700 px-3 text-sm font-bold hover:border-amber-400 disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              {destination && (
                <div className="mt-3 rounded-xl bg-slate-950 p-3">
                  <p className="break-words text-sm text-slate-300">
                    {destination.address}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {destination.lat.toFixed(6)}, {destination.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="mb-3 font-bold">Choose vehicle</p>

              <div className="grid grid-cols-3 gap-2">
                {["hatchback", "sedan", "suv"].map((vehicle) => (
                  <button
                    key={vehicle}
                    type="button"
                    onClick={() => setNotice(`Selected ${vehicle}.`)}
                    className="rounded-xl border border-slate-700 p-3 text-sm capitalize text-slate-300 hover:border-amber-400"
                  >
                    🚘 {vehicle}
                  </button>
                ))}
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Vehicle selection is visual only; the current backend
                request schema does not accept a vehicle type.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="break-words rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
              >
                {error}
              </div>
            )}

            {notice && !error && (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
              >
                {notice}
              </div>
            )}

            <button
              type="button"
              onClick={handleEstimate}
              disabled={
                estimating ||
                requesting ||
                !pickup ||
                !destination
              }
              className="w-full rounded-xl border border-amber-400 px-5 py-4 font-bold text-amber-400 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {estimating ? "Calculating fare..." : "Calculate estimated fare"}
            </button>

            {estimate && (
              <div className="rounded-2xl border border-amber-400/30 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Estimated distance</p>
                <p className="mt-1 text-2xl font-bold">
                  {Number(estimate.estimated_distance_km).toFixed(2)} km
                </p>

                <p className="mt-4 text-sm text-slate-400">
                  Estimated fare
                </p>
                <p className="mt-1 text-3xl font-black text-amber-400">
                  ₹{Number(estimate.estimated_fare).toFixed(2)}
                </p>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  This is an estimate. The final fare may depend on your
                  backend's ride and pricing rules.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleRequestRide}
              disabled={
                requesting ||
                estimating ||
                !pickup ||
                !destination
              }
              className="w-full rounded-xl bg-amber-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requesting ? "Requesting ride..." : "Request Ride"}
            </button>

            {ride && (
              <div className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-5">
                <p className="font-bold text-emerald-400">
                  Ride request created
                </p>

                {ride.id != null && (
                  <p className="mt-3 text-sm text-slate-300">
                    Ride ID: {ride.id}
                  </p>
                )}

                {ride.status && (
                  <p className="mt-2 text-sm text-slate-300">
                    Status:{" "}
                    <span className="font-semibold capitalize text-amber-400">
                      {String(ride.status).replaceAll("_", " ")}
                    </span>
                  </p>
                )}

                {ride.estimated_fare != null && (
                  <p className="mt-2 text-sm text-slate-300">
                    Estimated fare: ₹
                    {Number(ride.estimated_fare).toFixed(2)}
                  </p>
                )}

                <Link
                  to="/ride-history"
                  className="mt-4 inline-block font-semibold text-amber-400 hover:text-amber-300"
                >
                  View ride history →
                </Link>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div>
                <h2 className="font-bold">Choose on map</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {selecting === "pickup"
                    ? "Click the map to set pickup."
                    : "Click the map to set destination."}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelecting("pickup")}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    selecting === "pickup"
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Pickup
                </button>

                <button
                  type="button"
                  onClick={() => setSelecting("destination")}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    selecting === "destination"
                      ? "bg-rose-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Destination
                </button>
              </div>
            </div>

            <MapContainer
              center={mapCenter}
              zoom={5}
              scrollWheelZoom
              className="h-[500px] w-full"
              style={{ background: "#0f172a" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController
                position={selecting === "pickup" ? pickup : destination}
                onMapSelect={handleMapSelect}
                onMapReady={setMapInstance}
              />

              {pickup && (
                <Marker position={[pickup.lat, pickup.lng]}>
                  <Popup>
                    <strong>Pickup</strong>
                    <br />
                    {pickup.address}
                  </Popup>
                </Marker>
              )}

              {destination && (
                <Marker
                  position={[destination.lat, destination.lng]}
                >
                  <Popup>
                    <strong>Destination</strong>
                    <br />
                    {destination.address}
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            <div className="border-t border-slate-800 p-4 text-xs leading-5 text-slate-500">
              Map data © OpenStreetMap contributors. Search is performed
              when you press Search; map selection uses reverse geocoding.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
