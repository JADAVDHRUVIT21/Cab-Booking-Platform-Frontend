
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    // Clear any previous account session before signing in.
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: form,
      });

      const token = data.access_token || data.access || data.token;

      if (!token) {
        throw new Error("The server did not return an access token.");
      }

      // Save the newly authenticated account's token.
      localStorage.setItem("access_token", token);

      // Fetch the actual user and role from the backend.
      const user = await apiRequest("/api/auth/me", {
        token,
      });

      localStorage.setItem("user", JSON.stringify(user));

      // Both riders and drivers use the same login form.
      if (user.role === "driver") {
        navigate("/dashboard", { replace: true });
      } else if (user.role === "rider") {
        navigate("/dashboard", { replace: true });
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        throw new Error("Your account has an unsupported role.");
      }
    } catch (err) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-amber-400 p-10 text-slate-950 lg:flex xl:p-14">
          <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full border-[40px] border-slate-950/5" />

          <Link to="/" className="relative flex w-fit items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-xl font-black text-amber-400">
              C
            </span>
            <span className="text-2xl font-extrabold tracking-tight">
              CabGo
            </span>
          </Link>

          <div className="relative my-12">
            <span className="mb-5 inline-flex rounded-full border border-slate-950/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]">
              Your city. Your ride.
            </span>

            <h1 className="max-w-md text-5xl font-black leading-tight xl:text-6xl">
              Every journey starts with you.
            </h1>

            <p className="mt-6 max-w-sm text-base leading-7 text-slate-800">
              Book your next ride with ease and get where you need to go.
              Your journey is just a few clicks away.
            </p>
          </div>

          <div className="relative flex items-center gap-3 text-sm font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            A simpler way to travel
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-14">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-3 lg:hidden"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                C
              </span>
              <span className="text-xl font-extrabold">CabGo</span>
            </Link>

            <div className="mb-8">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
                Welcome back
              </p>

              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Sign in to CabGo
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Sign in with your registered rider or driver account.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="username"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-bold text-amber-400 transition hover:text-amber-300"
              >
                Create an account
              </Link>
            </p>

            <div className="mt-8 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
              Sign in with the email and password for your own account.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
