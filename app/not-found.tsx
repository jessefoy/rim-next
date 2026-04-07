import Link from "next/link";

export default function NotFound() {
  return (
    <div className="nf-page">
      <h1 className="nf-heading">Page Not Found</h1>
      <p className="nf-text">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="nf-link">
        Return home
      </Link>
    </div>
  );
}
