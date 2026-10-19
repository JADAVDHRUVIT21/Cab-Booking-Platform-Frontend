
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./auth/Login";
import Register from "./auth/Register";
import Dashboard from "./dashboard/Dashboard";
import BookRide from "./dashboard/BookRide";
import RideHistory from "./dashboard/RideHistory";
import RideDetails from "./dashboard/RideDetails";
import ReviewRating from "./dashboard/ReviewRating";

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-3xl font-black text-slate-950">
          C
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
          Your journey starts here
        </p>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Move smarter with{" "}
          <span className="text-amber-400">CabGo.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          Book your ride, reach your destination, and enjoy a simpler way to
          travel around your city.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href="/register"
            className="rounded-xl bg-amber-400 px-8 py-3.5 font-bold text-slate-950 transition hover:bg-amber-300"
          >
            Get started
          </a>

          <a
            href="/login"
            className="rounded-xl border border-slate-600 px-8 py-3.5 font-bold text-white transition hover:border-amber-400 hover:text-amber-400"
          >
            Sign in
          </a>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-2xl">🚘</div>
            <h2 className="mt-3 font-bold">Easy booking</h2>
            <p className="mt-2 text-sm text-slate-400">
              Request your ride in just a few steps.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-2xl">📍</div>
            <h2 className="mt-3 font-bold">Live tracking</h2>
            <p className="mt-2 text-sm text-slate-400">
              Follow your ride as your journey progresses.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-2xl">⭐</div>
            <h2 className="mt-3 font-bold">Rate your ride</h2>
            <p className="mt-2 text-sm text-slate-400">
              Share feedback after completing your trip.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/book-ride" element={<BookRide />} />
        <Route path="/ride-history" element={<RideHistory />} />
        <Route path="/ride-history/:id" element={<RideDetails />} />

        {/* Review & Rating page */}
        <Route path="/reviews" element={<ReviewRating />} />

        {/* Keep the legacy URL working too */}
        <Route
          path="/review-rating"
          element={<Navigate to="/reviews" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
