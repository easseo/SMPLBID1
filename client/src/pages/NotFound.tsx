import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Compass size={32} className="text-muted-2" />
      <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        This sample may have been won, or the link just doesn't exist.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-primary/50">
          Home
        </Link>
        <Link to="/arena" className="shimmer-bg rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg">
          Enter the Arena
        </Link>
      </div>
    </div>
  );
}
