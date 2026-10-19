import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../services/api";

const CANCELLABLE_STATUSES = [
  "requested",
  "matched",
  "accepted",
  "driver_arrived",
];

const DRIVER_ACTIONS = {
  matched: {
    endpoint: "accept",
    label: "Accept Ride",
    loadingLabel: "Accepting ride...",
    successMessage: "Ride accepted successfully.",
  },
  accepted: {
    endpoint: "arrived",
    label: "Mark Arrived",
    loadingLabel: "Updating arrival...",
    successMessage: "You have been marked as arrived.",
  },
  driver_arrived: {
    endpoint: "start",
    label: "Start Ride",
    loadingLabel: "Starting ride...",
    successMessage: "Ride started successfully.",
  },
  started: {
    endpoint: "complete",
    label: "Complete Ride",
    loadingLabel: "Completing ride...",
    successMessage: "Ride completed successfully.",
  },
};

function formatLabel(value) {
  return String(value || "Unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString();
}

function formatFare(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  return `₹${Number(value).toFixed(2)}`;
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-words font-semibold text-white">
        {value ?? "Not available"}
      </p>
    </div>
  );
}

export default function RideDetails() {
  const { id } = useParams();

  const [ride, setRide] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [driverActionLoading, setDriverActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [cancellationReason, setCancellationReason] =
    useState("Cancelled by user");

  const isDriver = user?.role === "driver";
  const isRider = user?.role === "rider";

  const loadRide = useCallback(async (showLoader = true) => {
    const token = localStorage.getItem("access_token");
    const savedUser = localStorage.getItem("user");

    if (!token) {
      setError("Please sign in to view ride details.");
      setLoading(false);
      return;
    }

    try {
      setUser(savedUser ? JSON.parse(savedUser) : null);
    } catch {
      setUser(null);
    }

    if (showLoader) setLoading(true);
    setError("");

    try {
      const result = await apiRequest(`/api/rides/${id}`, { token });
      setRide(result);
      return result;
    } catch (err) {
      setError(err.message || "Unable to load ride details.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRide();
  }, [loadRide]);

  async function handleDriverAction() {
    if (!ride || driverActionLoading) return;

    const status = String(ride.status || "").trim().toLowerCase();
    const action = DRIVER_ACTIONS[status];

    if (!action) return;

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please sign in again to update this ride.");
      return;
    }

    setDriverActionLoading(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/api/rides/${ride.id}/${action.endpoint}`, {
        method: "PATCH",
        token,
      });

      setNotice(action.successMessage);

      // Fetch the latest ride status after the action succeeds.
      await loadRide(false);
    } catch (err) {
      setError(err.message || "Unable to update this ride.");
    } finally {
      setDriverActionLoading(false);
    }
  }

  async function handleCancelRide() {
    if (!ride || cancelling) return;

    const reason = cancellationReason.trim();

    if (reason.length < 3) {
      setError("Enter a cancellation reason of at least 3 characters.");
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel ride #${ride.id}?`)) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Please sign in again to cancel this ride.");
      return;
    }

    setCancelling(true);
    setError("");
    setNotice("");

    try {
      const updatedRide = await apiRequest(
        `/api/rides/${ride.id}/cancel?reason=${encodeURIComponent(reason)}`,
        { method: "PATCH", token }
      );

      setRide(updatedRide);
      setNotice("Ride cancelled successfully.");
    } catch (err) {
      setError(err.message || "Unable to cancel this ride.");
    } finally {
      setCancelling(false);
    }
  }

  const status = String(ride?.status || "").trim().toLowerCase();
  const canCancel = isRider && CANCELLABLE_STATUSES.includes(status);
  const driverAction = isDriver ? DRIVER_ACTIONS[status] : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/dashboard"
          className="font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
            CabGo {isDriver ? "Driver" : isRider ? "Rider" : "Account"} Portal
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {isDriver ? "Driver Ride Details" : "Your Ride Details"}
          </h1>

          <p className="mt-2 text-slate-400">Ride #{id}</p>
        </header>

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 break-words rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Loading ride details...
          </div>
        ) : ride ? (
          <>
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 sm:p-8">
                <div>
                  <p className="text-sm text-slate-400">Current ride status</p>
                  <h2 className="mt-2 text-2xl font-extrabold">
                    {formatLabel(ride.status)}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Requested {formatDate(ride.requested_at)}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <p className="text-sm text-slate-400">
                    {isDriver ? "Ride fare" : "Estimated / final fare"}
                  </p>
                  <p className="mt-2 text-3xl font-black text-amber-400">
                    {formatFare(ride.final_fare ?? ride.estimated_fare)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Pickup location
                  </p>
                  <p className="mt-3 break-words font-semibold leading-7">
                    {ride.pickup_address || "Not available"}
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
                    Destination
                  </p>
                  <p className="mt-3 break-words font-semibold leading-7">
                    {ride.dropoff_address || "Not available"}
                  </p>
                </div>
              </div>
            </section>

            {isRider && (
              <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
                <h2 className="text-xl font-extrabold">Your trip summary</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Review your journey, fare and booking status.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Estimated distance"
                    value={
                      ride.estimated_distance_km == null
                        ? "Not available"
                        : `${Number(ride.estimated_distance_km).toFixed(2)} km`
                    }
                  />
                  <DetailItem
                    label="Estimated fare"
                    value={formatFare(ride.estimated_fare)}
                  />
                  <DetailItem
                    label="Final fare"
                    value={formatFare(ride.final_fare)}
                  />
                  <DetailItem
                    label="Booking time"
                    value={formatDate(ride.requested_at)}
                  />
                </div>

                {ride.cancellation_reason && (
                  <p className="mt-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300">
                    Cancellation reason: {ride.cancellation_reason}
                  </p>
                )}
              </section>
            )}

            {isDriver && (
              <>
                <section className="mt-6 rounded-2xl border border-amber-400/20 bg-slate-900 p-5 sm:p-7">
                  <h2 className="text-xl font-extrabold">
                    Driver trip information
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Review the trip details and use the action below to move
                    the ride through its next stage.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Ride ID" value={`#${ride.id}`} />
                    <DetailItem
                      label="Current status"
                      value={formatLabel(ride.status)}
                    />
                    <DetailItem
                      label="Estimated distance"
                      value={
                        ride.estimated_distance_km == null
                          ? "Not available"
                          : `${Number(ride.estimated_distance_km).toFixed(2)} km`
                      }
                    />
                    <DetailItem
                      label="Expected fare"
                      value={formatFare(
                        ride.final_fare ?? ride.estimated_fare
                      )}
                    />
                    <DetailItem
                      label="Assigned driver ID"
                      value={ride.driver_id ?? "Not assigned"}
                    />
                    <DetailItem
                      label="Booking time"
                      value={formatDate(ride.requested_at)}
                    />
                  </div>
                </section>

                {driverAction ? (
                  <section className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 sm:p-7">
                    <h2 className="text-xl font-extrabold">
                      Next driver action
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Current stage: {formatLabel(status)}. Continue only when
                      you are ready to perform this step.
                    </p>

                    <button
                      type="button"
                      onClick={handleDriverAction}
                      disabled={driverActionLoading}
                      className="mt-5 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {driverActionLoading
                        ? driverAction.loadingLabel
                        : driverAction.label}
                    </button>
                  </section>
                ) : (
                  <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <h2 className="font-bold">
                      {status === "completed"
                        ? "Ride completed"
                        : status === "cancelled"
                          ? "Ride cancelled"
                          : "No driver action available"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {status === "completed"
                        ? "This ride has been completed. No further action is required."
                        : status === "cancelled"
                          ? "This ride was cancelled. No further action is available."
                          : "The current ride status does not have a supported action here."}
                    </p>
                  </section>
                )}
              </>
            )}

            {canCancel && (
              <section className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 sm:p-7">
                <h2 className="text-xl font-extrabold">Cancel your ride</h2>
                <p className="mt-2 text-sm text-slate-400">
                  You can request cancellation while this ride is eligible.
                </p>

                <label
                  htmlFor="cancellation-reason"
                  className="mt-4 block text-sm font-semibold text-slate-300"
                >
                  Reason for cancellation
                </label>

                <textarea
                  id="cancellation-reason"
                  value={cancellationReason}
                  onChange={(event) =>
                    setCancellationReason(event.target.value)
                  }
                  minLength={3}
                  maxLength={250}
                  rows={3}
                  disabled={cancelling}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-amber-400 disabled:opacity-60"
                  placeholder="Enter your reason..."
                />

                <button
                  type="button"
                  onClick={handleCancelRide}
                  disabled={cancelling}
                  className="mt-4 rounded-xl bg-rose-500 px-5 py-3 font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel Ride"}
                </button>
              </section>
            )}

            {!isRider && !isDriver && (
              <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200">
                Your account role could not be identified. Please sign out and
                sign in again.
              </div>
            )}
          </>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/ride-history"
            className="rounded-xl border border-slate-700 px-5 py-3 font-bold transition hover:border-amber-400"
          >
            View ride history
          </Link>

          {isRider && (
            <Link
              to="/book-ride"
              className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
            >
              Book another ride
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}