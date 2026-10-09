import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/** How close to the left edge a back swipe has to start, like iOS's own. */
const EDGE = 28;
/** Past this distance (or a quick flick) letting go goes back; short of it, it snaps back. */
const COMMIT_DISTANCE = 90;
const COMMIT_VELOCITY = 0.6; // px/ms

/**
 * iOS-style "swipe from the left edge to go back" for the web build (Telegram's WebView
 * has no navigation gesture of its own). Goes back in the real history — to the screen
 * and tab you came from, scroll position intact — never to a fixed screen. Off on the
 * tab roots (nothing to go back to) and while a bottom sheet/modal is open.
 */
export function useEdgeSwipeBack(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root) return;

    let start: { x: number; y: number; at: number } | null = null;
    let dragging = false;
    let offset = 0;

    const setOffset = (x: number, animate: boolean) => {
      root.style.transition = animate ? "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
      root.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
      root.style.boxShadow = x ? "-14px 0 28px rgba(0, 0, 0, 0.35)" : "";
    };
    const modalOpen = () => document.querySelector('[aria-modal="true"]') !== null;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || touch.clientX > EDGE) return;
      if (modalOpen() || !router.canGoBack()) return;
      start = { x: touch.clientX, y: touch.clientY, at: performance.now() };
      dragging = false;
      offset = 0;
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!dragging) {
        // A mostly-vertical move is a scroll that happened to start near the edge.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          start = null;
          return;
        }
        if (dx < 8) return;
        dragging = true;
      }
      event.preventDefault();
      offset = Math.max(0, dx);
      setOffset(offset, false);
    };

    const onEnd = () => {
      if (!start) return;
      const velocity = offset / Math.max(1, performance.now() - start.at);
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (!wasDragging) return;
      if (offset < COMMIT_DISTANCE && velocity < COMMIT_VELOCITY) {
        setOffset(0, true);
        return;
      }
      setOffset(window.innerWidth, true);
      window.setTimeout(() => {
        router.back();
        // Next frame, once the previous screen has rendered; the timeout is a fallback for
        // a WebView that throttles animation frames.
        const reset = () => setOffset(0, false);
        requestAnimationFrame(reset);
        window.setTimeout(reset, 120);
      }, 190);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      setOffset(0, false);
    };
  }, []);
}
