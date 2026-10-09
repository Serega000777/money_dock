import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * iOS (Telegram's WebView included) answers a focused input by scrolling the whole
 * document up — on top of the layout already shrinking to the area above the keyboard —
 * so the screen jumped far past the input and left an empty band over the keyboard. No
 * screen scrolls the document itself (each scrolls inside its own ScrollView), so the
 * root is sized to the visible viewport and any document scroll the browser adds is undone.
 *
 * Inputs inside a Modal (bottom sheets) are left alone: a Modal is portalled outside
 * `#root` and sized to the full window, so there the browser's own scroll is what keeps
 * the focused field above the keyboard.
 */
export function useVisualViewportLock(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    const root = document.getElementById("root");
    if (!viewport || !root) return;

    const sync = () => {
      // × scale so pinch-zoom doesn't shrink the layout; the keyboard never changes scale.
      root.style.height = `${Math.round(viewport.height * viewport.scale)}px`;
      const focused = document.activeElement;
      const focusInRoot = !focused || focused === document.body || root.contains(focused);
      if (focusInRoot && window.scrollY !== 0) window.scrollTo(0, 0);
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("scroll", sync);
      root.style.height = "";
    };
  }, []);
}
