import { useEffect, useState, useRef } from "react";
import {
  loadGoogleTranslate,
  initWidget,
  ensureBannerHidden,
  setLanguage,
  killBannerForever,
} from "./googleTranslate";

/**
 * Props:
 * - mount: render the hidden #google_translate_element container (default: true)
 * - init:  run the one-time init effect that loads/creates the Google widget (default: true)
 *
 * Use <TranslateToggle /> for desktop (defaults).
 * Use <TranslateToggle mount={false} init={false} /> for the mobile copy (no duplicate ID/init).
 */
export default function TranslateToggle({ mount = true, init = true }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const LANGS = [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "es", label: "Español" },
    { code: "pt", label: "Português" },
    { code: "it", label: "Italiano" },
    { code: "ar", label: "العربية" },
    { code: "hi", label: "हिन्दी" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
    { code: "zh-CN", label: "简体中文" },
    { code: "ru", label: "Русский" },
    // { code: "yo", label: "Yorùbá" },
    // { code: "ig", label: "Igbo" },
    // { code: "ha", label: "Hausa" },
  ];

  useEffect(() => {
    if (!init) return; // only the primary instance should init

    // Hide banner UI and keep it dead
    ensureBannerHidden();
    killBannerForever();

    // Load Google translator, then init hidden widget
    loadGoogleTranslate().then(() => {
      ensureBannerHidden();
      killBannerForever();
      initWidget("google_translate_element");
    });

    // Close dropdown on outside click + Esc
    const onClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [init]);

  // Read current cookie for label
  const current = document.cookie.match(/googtrans=\/auto\/([^;]+)/)?.[1] || "en";
  const currentLabel =
    LANGS.find((l) => l.code === current)?.label || "Translate";

  return (
    <div className="relative" ref={menuRef}>
      {/* Hidden mount for Google’s element (engine lives here) */}
      {mount && (
        <div
          id="google_translate_element"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "150px",   // real size so Google renders the <select>
            height: "40px",
            opacity: 0,       // invisible
            pointerEvents: "none",
            zIndex: 0,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sleek pill button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-200 bg-white hover:bg-white text-sm font-medium"
        title="Translate this page"
      >
        <span role="img" aria-label="globe">🌍</span>
        <span className="hidden sm:inline">{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg p-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white ${
                current === l.code ? "bg-white font-semibold" : ""
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
