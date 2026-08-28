import { Link } from "react-router-dom";
import { ArrowLeft, Activity } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-bg px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-tint text-blue">
        <Activity className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-navy">Page not found</h1>
      <p className="mt-2 max-w-sm text-[14.5px] text-navy-muted">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-[14.5px] font-semibold text-white shadow-soft transition-colors hover:bg-blue-dark"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Back to Home
      </Link>
    </div>
  );
}
