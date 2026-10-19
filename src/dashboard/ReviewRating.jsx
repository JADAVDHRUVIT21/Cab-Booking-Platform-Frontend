
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";

function Stars({ rating, interactive = false, onChange }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          aria-label={`Rate ${star} out of 5 stars`}
          aria-pressed={interactive ? rating === star : undefined}
          className={`text-2xl transition ${
            star <= rating ? "text-amber-400" : "text-slate-600"
          } ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function ReviewRating() {
  const [rides, setRides] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [driverId, setDriverId] = useState("");
  const [driverReviews, setDriverReviews] = useState([]);
  const [driverRating, setDriverRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingRide, setSubmittingRide] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const token = localStorage.getItem("access_token");

  const loadPage = useCallback(async () => {
    if (!token) {
      setError("Please sign in to access reviews and ratings.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [rideResult, historyResult] = await Promise.all([
        apiRequest("/api/rides/history?page=1&page_size=100", { token }),
        apiRequest("/api/reviews/my", { token }).catch((err) => {
          // The existing backend may not yet expose a personal-review endpoint.
          if (err.message.includes("404")) return [];
          throw err;
        }),
      ]);

      setRides(Array.isArray(rideResult) ? rideResult : []);
      setReviews(Array.isArray(historyResult) ? historyResult : []);
    } catch (err) {
      setError(err.message || "Unable to load reviews and rides.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function submitReview(ride) {
    const rating = ratings[ride.id] || 0;

    if (rating < 1 || rating > 5) {
      setError("Please select a rating from 1 to 5 stars.");
      return;
    }

    setSubmittingRide(ride.id);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/reviews", {
        method: "POST",
        token,
        body: {
          ride_id: ride.id,
          rating,
          comment: (comments[ride.id] || "").trim() || null,
        },
      });

      setReviews((previous) => [...previous, result]);
      setMessage(`Thank you! Your review for ride #${ride.id} was submitted.`);
      setRatings((previous) => ({ ...previous, [ride.id]: 0 }));
      setComments((previous) => ({ ...previous, [ride.id]: "" }));
    } catch (err) {
      setError(err.message || "Unable to submit your review.");
    } finally {
      setSubmittingRide(null);
    }
  }

  async function lookupDriver(event) {
    event.preventDefault();

    const id = Number(driverId);
    if (!Number.isInteger(id) || id < 1) {
      setLookupError("Enter a valid driver ID.");
      return;
    }

    setLookupLoading(true);
    setLookupError("");
    setDriverReviews([]);
    setDriverRating(null);

    try {
      const [ratingResult, reviewsResult] = await Promise.all([
        apiRequest(`/api/reviews/drivers/${id}/rating`),
        apiRequest(`/api/reviews/drivers/${id}`),
      ]);

      setDriverRating(ratingResult);
      setDriverReviews(Array.isArray(reviewsResult) ? reviewsResult : []);
    } catch (err) {
      setLookupError(err.message || "Unable to load driver reviews.");
    } finally {
      setLookupLoading(false);
    }
  }

  const reviewedRideIds = new Set(reviews.map((review) => Number(review.ride_id)));
  const completedRides = rides.filter(
    (ride) => String(ride.status).toLowerCase() === "completed"
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
            CabGo feedback
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Reviews & Ratings
          </h1>
          <p className="mt-3 text-slate-400">
            Rate your completed trips and share feedback about your driver.
          </p>
        </header>

        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Rate your completed rides</h2>
              <p className="mt-2 text-sm text-slate-400">
                Each completed ride can be reviewed once.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPage}
              disabled={loading}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold hover:border-amber-400 disabled:opacity-50"
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading completed rides...
            </div>
          ) : completedRides.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="text-3xl">⭐</p>
              <h3 className="mt-3 text-lg font-bold">No completed rides yet</h3>
              <p className="mt-2 text-sm text-slate-400">
                After you complete a trip, you can leave a rating here.
              </p>
              <Link to="/book-ride" className="mt-5 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300">
                Book a ride
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {completedRides.map((ride) => {
                const alreadyReviewed = reviewedRideIds.has(Number(ride.id));

                return (
                  <article key={ride.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Ride #{ride.id}
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                          {formatDate(ride.requested_at)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        alreadyReviewed
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}>
                        {alreadyReviewed ? "Reviewed" : "Awaiting review"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-xs font-semibold uppercase text-emerald-400">Pickup</p>
                        <p className="mt-2 break-words text-sm text-slate-200">
                          {ride.pickup_address || "Not available"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-xs font-semibold uppercase text-rose-400">Destination</p>
                        <p className="mt-2 break-words text-sm text-slate-200">
                          {ride.dropoff_address || "Not available"}
                        </p>
                      </div>
                    </div>

                    {alreadyReviewed ? (
                      <p className="mt-4 text-sm text-emerald-300">
                        You have already submitted a review for this ride.
                      </p>
                    ) : (
                      <div className="mt-5 border-t border-slate-800 pt-5">
                        <label className="text-sm font-semibold">Your rating</label>
                        <div className="mt-2">
                          <Stars
                            rating={ratings[ride.id] || 0}
                            interactive
                            onChange={(value) =>
                              setRatings((previous) => ({
                                ...previous,
                                [ride.id]: value,
                              }))
                            }
                          />
                        </div>
                        <label htmlFor={`comment-${ride.id}`} className="mt-4 block text-sm font-semibold">
                          Comment <span className="font-normal text-slate-500">(optional)</span>
                        </label>
                        <textarea
                          id={`comment-${ride.id}`}
                          rows={3}
                          maxLength={1000}
                          value={comments[ride.id] || ""}
                          onChange={(event) =>
                            setComments((previous) => ({
                              ...previous,
                              [ride.id]: event.target.value,
                            }))
                          }
                          placeholder="How was your ride?"
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-amber-400"
                        />
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">
                            {(comments[ride.id] || "").length}/1000 characters
                          </span>
                          <button
                            type="button"
                            onClick={() => submitReview(ride)}
                            disabled={submittingRide === ride.id}
                            className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {submittingRide === ride.id ? "Submitting..." : "Submit review"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <h2 className="text-2xl font-bold">Explore driver ratings</h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter a driver ID to see their average rating and reviews.
          </p>

          <form onSubmit={lookupDriver} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="number"
              min="1"
              required
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              placeholder="Enter driver ID"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {lookupLoading ? "Loading..." : "View ratings"}
            </button>
          </form>

          {lookupError && (
            <p role="alert" className="mt-4 text-sm text-rose-300">{lookupError}</p>
          )}

          {driverRating && (
            <div className="mt-6 rounded-xl bg-slate-950 p-5">
              <h3 className="text-xl font-bold">{driverRating.driver_name}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Stars rating={Math.round(Number(driverRating.rating_avg) || 0)} />
                <span className="font-bold text-amber-400">
                  {Number(driverRating.rating_avg).toFixed(2)} / 5
                </span>
                <span className="text-sm text-slate-400">
                  {driverRating.total_reviews} review(s)
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {driverReviews.length === 0 ? (
                  <p className="text-sm text-slate-400">This driver has no reviews yet.</p>
                ) : (
                  driverReviews.map((review) => (
                    <article key={review.id} className="rounded-xl border border-slate-800 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Stars rating={Number(review.rating) || 0} />
                        <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
                        {review.comment || "No written comment."}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-800 py-6 text-center text-sm text-slate-500">
          CabGo · Your feedback helps improve every journey.
        </footer>
      </div>
    </main>
  );
}
