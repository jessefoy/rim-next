"use client";

/**
 * RoomErrorBoundary — the session room's crash safety net.
 *
 * Before this existed, ANY uncaught render error inside the room (LiveKit
 * layout components included) fell through to Next.js's last-resort white
 * "Application Error" screen — which is exactly what every remote participant
 * saw when a screen share started (June 2026 hosting-coordinator session).
 * The room is RIM's highest-stakes surface: a render bug must degrade to a
 * calm contained screen with a Rejoin path, never a dead white page.
 *
 * The caught error is logged with the [rim-room-crash] prefix so a repro
 * with DevTools open hands us the exact component stack.
 *
 * Rejoin calls onRecover (the page's retry — fresh token + full remount)
 * after resetting the boundary, so the user re-enters cleanly without a
 * manual page refresh.
 */

import { Component, type ReactNode } from "react";

interface Props {
  /** Re-fetch the token and remount the room (the page's retry()). */
  onRecover: () => void;
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

export default class RoomErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[rim-room-crash]", error, info.componentStack ?? "");
  }

  handleRejoin = () => {
    this.setState({ crashed: false });
    this.props.onRecover();
  };

  render() {
    if (this.state.crashed) {
      return (
        <div className="vs-message vs-message--crash">
          <p className="vs-message__title">Something interrupted the room</p>
          <p className="vs-message__text">
            A hiccup on this device closed your view of the session. The
            session itself is most likely still going — you can rejoin right
            away.
          </p>
          <div className="vs-message__actions">
            <button className="btn" onClick={this.handleRejoin}>
              Rejoin
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
