import Link from "next/link";

export default function NotFound() {
  return (
    <div className="utility-page-wrap">
      <div className="utility-page-content w-form">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://d3e54v103j8qbb.cloudfront.net/static/page-not-found.211a85e40c.svg"
          alt=""
        />
        <h2>Page Not Found</h2>
        <div>The page you are looking for doesn&apos;t exist or has been moved.</div>
        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/" className="button-2 w-button">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
