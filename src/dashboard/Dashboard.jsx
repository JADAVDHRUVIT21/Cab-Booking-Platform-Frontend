import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [rides, setRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(false);
  const [ridesError, setRidesError] = useState("");
  const [rideActionLoading, setRideActionLoading] = useState({});

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login", { replace: true });
      return null;
    }

    try {
      const data = await apiRequest("/api/auth/me", { token });
      const currentUser = data.user || data;

      setUser(currentUser);
      localStorage.setItem("user", JSON.stringify(currentUser));
      setError("");

      return currentUser;
    } catch (err) {
      setError(err.message || "Unable to load your account.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadAssignedRides = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    setRidesLoading(true);
    setRidesError("");

    try {
      const data = await apiRequest("/api/rides/driver/assigned", {
        token,
      });

      setRides(Array.isArray(data) ? data : data?.rides || []);
    } catch (err) {
      setRidesError(err.message || "Unable to load assigned rides.");
    } finally {
      setRidesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (user?.role?.toLowerCase() === "driver") {
      loadAssignedRides();
    }
  }, [user?.role, loadAssignedRides]);

  async function toggleAvailability() {
    const token = localStorage.getItem("access_token");

    if (!token || !user || availabilityLoading) return;

    const nextAvailability = !Boolean(user.is_available);

    setAvailabilityLoading(true);
    setMessage("");
    setActionError("");

    try {
      const result = await apiRequest("/api/auth/driver/availability", {
        method: "PATCH",
        token,
        body: { is_available: nextAvailability },
      });

      if (
        typeof result?.is_available !== "boolean" ||
        result.is_available !== nextAvailability
      ) {
        throw new Error(
          "The server did not confirm the availability change. Please try again."
        );
      }

      const confirmedUser = {
        ...user,
        is_available: result.is_available,
      };

      setUser(confirmedUser);
      localStorage.setItem("user", JSON.stringify(confirmedUser));

      setMessage(
        result.is_available
          ? "You are now online and available for ride requests."
          : "You are now offline."
      );

      try {
        const refreshedData = await apiRequest("/api/auth/me", { token });
        const refreshedUser = refreshedData.user || refreshedData;

        if (typeof refreshedUser.is_available === "boolean") {
          setUser((previous) => {
            const mergedUser = {
              ...(previous || confirmedUser),
              ...refreshedUser,
            };

            localStorage.setItem("user", JSON.stringify(mergedUser));
            return mergedUser;
          });

          if (refreshedUser.is_available !== result.is_available) {
            setActionError(
              "Availability was saved, but the account refresh returned a different status. Please refresh the page and check again."
            );
          }
        }
      } catch {
        // Keep the availability confirmed by the PATCH response.
      }

      await loadAssignedRides();
    } catch (err) {
      setActionError(err.message || "Unable to update availability.");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  function updateDriverLocation() {
    const token = localStorage.getItem("access_token");

    if (!token || locationLoading) return;

    setMessage("");
    setActionError("");

    if (!navigator.geolocation) {
      setActionError("Your browser does not support location access.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await apiRequest("/api/auth/driver/location", {
            method: "PATCH",
            token,
            body: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });

          setMessage(
            result?.message || "Your location was updated successfully."
          );

          await loadAssignedRides();
        } catch (err) {
          setActionError(err.message || "Unable to save your location.");
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        const text =
          err.code === 1
            ? "Location permission was denied. Allow location access in your browser."
            : err.code === 3
              ? "Getting your location timed out. Please try again."
              : "Unable to get your location. Check your device location settings.";

        setActionError(text);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }

  async function handleRideAction(rideId, action) {
    const token = localStorage.getItem("access_token");

    if (!token || rideActionLoading[rideId]) return;

    setMessage("");
    setActionError("");

    setRideActionLoading((previous) => ({
      ...previous,
      [rideId]: action,
    }));

    try {
      const result = await apiRequest(`/api/rides/${rideId}/${action}`, {
        method: "PATCH",
        token,
      });

      const updatedStatus = String(result?.status || "").toUpperCase();

      if (
        action === "accept" &&
        updatedStatus !== "ACCEPTED"
      ) {
        throw new Error(
          "The server did not confirm that the ride was accepted. Refresh the rides list to check its status."
        );
      }

      if (
        action === "reject" &&
        !["MATCHED", "REQUESTED"].includes(updatedStatus)
      ) {
        throw new Error(
          "The server returned an unexpected ride status. Refresh the rides list to check its status."
        );
      }

      setMessage(
        action === "accept"
          ? `Ride #${rideId} accepted successfully.`
          : `Ride #${rideId} rejected. ${result?.driver_id ? "The ride has been reassigned." : "No other available driver was found."}`
      );

      await loadAssignedRides();
      await loadUser();
    } catch (err) {
      setActionError(err.message || `Unable to ${action} this ride.`);
      await loadAssignedRides();
    } finally {
      setRideActionLoading((previous) => {
        const next = { ...previous };
        delete next[rideId];
        return next;
      });
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading your dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-bold">Session unavailable</h1>
          <p className="mt-3 break-words text-sm text-slate-400">
            {error || "Please sign in again."}
          </p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="mt-6 rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 hover:bg-amber-300"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  const name = user.name || "Traveler";
  const role = String(user.role || "").toLowerCase();
  const isDriver = role === "driver";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">
              C
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              CabGo
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:block">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:border-amber-400 hover:text-amber-400"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-amber-400 p-7 text-slate-950 sm:p-10">
          <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[35px] border-slate-950/5" />

          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-[0.2em]">
              {isDriver ? "Driver workspace" : "Your CabGo account"}
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              Welcome, {name}!
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-800 sm:text-base">
              {isDriver
                ? "Manage your availability, update your location, and view rides assigned to you."
                : "Book your next ride, follow your journeys, and review your trip history."}
            </p>
            <p className="mt-4 inline-flex rounded-full bg-slate-950/10 px-4 py-2 text-xs font-bold uppercase tracking-wider">
              Account type: {role}
            </p>
          </div>
        </section>

        {isDriver ? (
          <>
            <section className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm font-semibold text-slate-400">
                  Driver availability
                </p>
                <h2 className="mt-3 text-2xl font-extrabold">
                  {user.is_available ? "You're online" : "You're offline"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {user.is_available
                    ? "You are marked available to receive ride requests."
                    : "Go online when you're ready to accept ride requests."}
                </p>
                <button
                  onClick={toggleAvailability}
                  disabled={availabilityLoading}
                  className="mt-5 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {availabilityLoading
                    ? "Updating..."
                    : user.is_available
                      ? "Go offline"
                      : "Go online"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm font-semibold text-slate-400">
                  Your location
                </p>
                <h2 className="mt-3 text-2xl font-extrabold">
                  Update GPS location
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Share your current location so nearby ride requests can be
                  matched with you.
                </p>
                <button
                  onClick={updateDriverLocation}
                  disabled={locationLoading}
                  className="mt-5 rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold transition hover:border-amber-400 hover:text-amber-400 disabled:opacity-60"
                >
                  {locationLoading ? "Updating location..." : "Update my location"}
                </button>
              </div>
            </section>

            {message && (
              <p role="status" className="mt-4 text-sm text-emerald-400">
                {message}
              </p>
            )}
            {actionError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {actionError}
              </p>
            )}

            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold">Assigned rides</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Review assigned rides, then accept or reject new matches.
                  </p>
                </div>
                <button
                  onClick={loadAssignedRides}
                  disabled={ridesLoading}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-amber-400 disabled:opacity-60"
                >
                  {ridesLoading ? "Refreshing..." : "Refresh rides"}
                </button>
              </div>

              {ridesError && (
                <p role="alert" className="mt-4 text-sm text-red-400">
                  {ridesError}
                </p>
              )}

              {ridesLoading ? (
                <p className="mt-6 text-sm text-slate-400">
                  Loading assigned rides...
                </p>
              ) : rides.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                  <p className="text-lg font-bold">No rides assigned yet</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Stay online, update your location, and refresh this section
                    after a rider requests a nearby ride.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {rides.map((ride) => {
                    const rideStatus = String(ride.status || "").toUpperCase();
                    const isMatched = rideStatus === "MATCHED";
                    const actionInProgress = Boolean(
                      rideActionLoading[ride.id]
                    );

                    return (
                      <article
                        key={ride.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-amber-400/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-bold">
                            Ride #{ride.id}
                          </h3>
                          <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold capitalize text-amber-400">
                            {String(ride.status || "assigned").replaceAll("_", " ").toLowerCase()}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-400">
                          Pickup: {ride.pickup_address || ride.pickup_location || "Not available"}
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                          Destination: {ride.dropoff_address || ride.dropoff_location || "Not available"}
                        </p>

                        {ride.estimated_fare != null && (
                          <p className="mt-3 text-sm font-semibold text-slate-300">
                            Estimated fare: ₹{Number(ride.estimated_fare).toFixed(2)}
                          </p>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link
                            to={`/ride-history/${ride.id}`}
                            className="inline-flex items-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold transition hover:border-amber-400 hover:text-amber-400"
                          >
                            View ride details →
                          </Link>

                          {isMatched && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRideAction(ride.id, "accept")}
                                disabled={actionInProgress}
                                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rideActionLoading[ride.id] === "accept"
                                  ? "Accepting..."
                                  : "Accept Ride"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRideAction(ride.id, "reject")}
                                disabled={actionInProgress}
                                className="rounded-xl border border-red-500/50 px-4 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rideActionLoading[ride.id] === "reject"
                                  ? "Rejecting..."
                                  : "Reject Ride"}
                              </button>
                            </>
                          )}

                          {rideStatus === "ACCEPTED" && (
                            <span className="inline-flex items-center rounded-xl bg-emerald-400/10 px-4 py-2.5 text-sm font-bold text-emerald-400">
                              Ride accepted
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/book-ride"
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-amber-400/60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-2xl">
                🚘
              </span>
              <h2 className="mt-5 text-xl font-bold">Book a ride</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Enter your pickup and destination to plan a trip.
              </p>
              <span className="mt-5 inline-block text-sm font-bold text-amber-400">
                Book now →
              </span>
            </Link>

            <Link
              to="/ride-history"
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-amber-400/60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-400/10 text-2xl">
                🧾
              </span>
              <h2 className="mt-5 text-xl font-bold">Ride history</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review your previous trips and ride details.
              </p>
              <span className="mt-5 inline-block text-sm font-bold text-amber-400">
                View history →
              </span>
            </Link>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10 text-2xl">
                ⭐
              </span>
              <h2 className="mt-5 text-xl font-bold">Reviews and ratings</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Rate completed rides and share your experience.
              </p>
              <span className="mt-5 inline-block text-sm font-semibold text-slate-500">
                Available after a ride
              </span>
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-slate-800 py-6 text-center text-sm text-slate-500">
          CabGo · Your journey, made simpler.
        </footer>
      </div>
    </main>
  );
}