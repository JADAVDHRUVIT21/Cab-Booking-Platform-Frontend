
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";

function formatStatus(status) {
  return String(status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
}

function formatFare(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  return `₹${Number(value).toFixed(2)}`;
}

function statusStyle(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (normalized === "cancelled") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }

  if (["matched", "accepted", "driver_arrived", "started"].includes(normalized)) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export default function RideHistory() {
  const [rides, setRides] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 10;

  const loadRides = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please sign in to view your ride history.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(
        `/api/rides/history?page=${page}&page_size=${pageSize}`,
        { token }
      );

      setRides(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Unable to load ride history.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
              CabGo account
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Ride History
            </h1>
            <p className="mt-3 text-slate-400">
              Review your previous and current ride requests.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRides}
            disabled={loading}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold transition hover:border-amber-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-6 break-words rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading your rides...
          </div>
        ) : !error && rides.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-14 text-center">
            <div className="text-4xl">🚕</div>
            <h2 className="mt-4 text-xl font-bold">No rides on this page</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your ride requests will appear here.
            </p>
            <Link
              to="/book-ride"
              className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300"
            >
              Book a ride
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-4">
              {rides.map((ride) => (
                <article
                  key={ride.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Ride #{ride.id}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        {formatDate(ride.requested_at)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusStyle(ride.status)}`}
                    >
                      {formatStatus(ride.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Pickup
                      </p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                        {ride.pickup_address || "Not available"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                        Destination
                      </p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                        {ride.dropoff_address || "Not available"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-800 pt-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Estimated distance
                      </p>
                      <p className="mt-1 font-semibold">
                        {ride.estimated_distance_km == null
                          ? "Not available"
                          : `${Number(ride.estimated_distance_km).toFixed(2)} km`}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Fare</p>
                      <p className="mt-1 text-lg font-black text-amber-400">
                        {formatFare(
                          ride.final_fare ?? ride.estimated_fare
                        )}
                      </p>
                    </div>

                    <Link
                      to={`/ride-history/${ride.id}`}
                      className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold transition hover:border-amber-400"
                    >
                      View details →
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || loading}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>

              <span className="text-sm text-slate-400">
                Page {page}
              </span>

              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={rides.length < pageSize || loading}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </>
        )}

        <div className="mt-8">
          <Link
            to="/book-ride"
            className="font-semibold text-amber-400 hover:text-amber-300"
          >
            + Book another ride
          </Link>
        </div>
      </div>
    </main>
  );
}
