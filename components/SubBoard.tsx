"use client";

import { useState } from "react";
import SubRequestForm from "./SubRequestForm";

interface SubRequester {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface SubRequestItem {
  id: string;
  programSlug: string;
  programName: string; // resolved from Sanity
  sessionDate: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  requester: SubRequester;
  assignmentId: string;
  claim: null | {
    id: string;
    message: string | null;
    createdAt: string;
    claimedBy: SubRequester;
  };
}

interface Assignment {
  id: string;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
}

interface Props {
  initialRequests: SubRequestItem[];
  myAssignments: Assignment[];
  currentUserId: string;
}

function displayName(u: SubRequester): string {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function SubBoard({ initialRequests, myAssignments, currentUserId }: Props) {
  const [requests, setRequests] = useState<SubRequestItem[]>(initialRequests);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(requestId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/host/sub-requests/${requestId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: claimMessage.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      // Remove claimed request from the list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setClaimingId(null);
      setClaimMessage("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function refreshList() {
    // Reload open requests from API
    fetch("/api/host/sub-requests")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRequests(data.map((r: SubRequestItem) => ({
            ...r,
            programName: r.programSlug, // no Sanity lookup in client; use slug
          })));
        }
      })
      .catch(() => {});
  }

  return (
    <div className="hub-subboard">
      <div className="hub-subboard__header">
        <div>
          <h2 className="hub-subboard__title">Open Sub Requests</h2>
          <p className="hub-subboard__desc">If you can&rsquo;t make a session, post a request here. Anyone on the host team can claim it.</p>
        </div>
        <SubRequestForm assignments={myAssignments} onCreated={refreshList} />
      </div>

      {requests.length === 0 ? (
        <p className="hub-subboard__empty">No open requests right now — all hands on deck.</p>
      ) : (
        <ul className="hub-subboard__list">
          {requests.map((req) => {
            const isOwnRequest = req.requester.id === currentUserId;
            const isClaiming = claimingId === req.id;

            return (
              <li key={req.id} className="hub-subboard__item">
                <div className="hub-subboard__meta">
                  <span className="hub-subboard__program">
                    {req.programName || req.programSlug}
                  </span>
                  {req.sessionDate && (
                    <span className="hub-subboard__date">{formatDate(req.sessionDate)}</span>
                  )}
                </div>

                <p className="hub-subboard__requester">
                  Requested by{" "}
                  <strong>{isOwnRequest ? "you" : displayName(req.requester)}</strong>
                  {" · "}
                  <span className="hub-subboard__posted">{formatDate(req.createdAt)}</span>
                </p>

                {req.message && (
                  <p className="hub-subboard__message">"{req.message}"</p>
                )}

                {!isOwnRequest && (
                  <>
                    {isClaiming ? (
                      <div className="hub-subboard__claim-form">
                        <textarea
                          className="hub-form-textarea"
                          rows={2}
                          value={claimMessage}
                          onChange={(e) => setClaimMessage(e.target.value)}
                          placeholder="Optional note to the host (e.g., 'Happy to cover, feel free to reach out')"
                        />
                        {error && <p className="hub-form-error">{error}</p>}
                        <div className="hub-form-actions">
                          <button
                            className="hub-btn"
                            onClick={() => handleClaim(req.id)}
                            disabled={submitting}
                          >
                            {submitting ? "Claiming…" : "Confirm — I'll take it"}
                          </button>
                          <button
                            className="hub-btn hub-btn--ghost"
                            onClick={() => { setClaimingId(null); setClaimMessage(""); setError(null); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="hub-btn hub-btn--sm"
                        onClick={() => { setClaimingId(req.id); setClaimMessage(""); setError(null); }}
                      >
                        I&apos;ll take it
                      </button>
                    )}
                  </>
                )}

                {isOwnRequest && (
                  <span className="hub-subboard__own-badge">Your request</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
