"use client";

import Link from "next/link";
import { useState } from "react";

interface FooterProps {
  memberArea?: boolean;
}

export default function Footer({ memberArea = false }: FooterProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setMessage("We need an email address to add you.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: firstName }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setMessage(
          data.error ||
            "Something went wrong. Try again, or email us and we'll add you ourselves.",
        );
      }
    } catch {
      setMessage("Something went wrong. Try again, or email us and we'll add you ourselves.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="rim-footer">
      <div className="rim-footer-inner">
        {!memberArea && (
          <>
            <div className="rim-footer-newsletter">
              <h3 className="rim-footer-heading">Stay Connected</h3>
              <p className="rim-footer-sub">
                Sign up for the RIM newsletter for upcoming programs, retreats, and community news.
                That is all we will send.
              </p>
              {submitted ? (
                <p className="footer-subscribe-success">Thank you. You&apos;re on the list.</p>
              ) : (
                <form className="footer-subscribe-form" onSubmit={handleSubmit} noValidate>
                  <div className="footer-subscribe-row">
                    <input
                      type="text"
                      name="first_name"
                      placeholder="First name"
                      className="footer-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email address"
                      className="footer-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <button type="submit" className="footer-subscribe-btn" disabled={loading}>
                      {loading ? "Subscribing…" : "Subscribe"}
                    </button>
                  </div>
                  {message && <p className="footer-subscribe-msg">{message}</p>}
                </form>
              )}
            </div>
            <div className="rim-footer-divider"></div>
          </>
        )}

        <div className="rim-footer-contact">
          <img src="/images/RIM-Website-Footer-Logo-White.png" alt="Rooted In Mindfulness" width={65} className="rim-footer-logo" />
          <div className="rim-footer-name">Rooted In Mindfulness</div>
          <div className="rim-footer-address">4040 N. Calhoun Rd., Brookfield, WI 53005</div>
          <div className="rim-footer-contact-links">
            <a href="tel:4148828932">(414) 882-8932</a>
            <span className="rim-footer-dot">·</span>
            <a href="mailto:support@rootedinmindfulness.org?subject=Dear%20RIM%20Support">
              support@rootedinmindfulness.org
            </a>
          </div>
        </div>
      </div>

      <div className="rim-footer-bottom">
        <span>
          ©2020 Rooted In Mindfulness | 501(c)(3) Non-Profit |{" "}
          <Link href="/community-care-agreements">Community Care</Link> |{" "}
          <Link href="/donate">Donate</Link>
        </span>
        <span>Powered by Kind People :) <Link href="/volunteerism/volunteer">Volunteer</Link></span>
      </div>
    </footer>
  );
}
