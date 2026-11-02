import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { FileText, Loader2 } from "lucide-react";

if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "3.11.174"}/build/pdf.worker.min.js`;
}

const pdfThumbnailCache = new Map();

const resolveEffectivePdfUrl = (url) => {
  if (!url) return "";

  let normalized = url.trim();

  // If URL is relative, prepend API base or root
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    let rawBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      if (!rawBase || /localhost|127\.0\.0\.1/i.test(rawBase)) {
        rawBase = import.meta.env.VITE_API_URL || window.location.origin;
      }
    }
    const cleanPath = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    normalized = rawBase ? `${rawBase}/${cleanPath}` : `/${cleanPath}`;
  }

  // Rewrite /uploads/ to /api/uploads/ ONLY if not already routed via /api/uploads/
  if (normalized.includes("/uploads/") && !normalized.includes("/api/uploads/")) {
    normalized = normalized.replace("/uploads/", "/api/uploads/");
  }

  // Collapse any accidental duplicate /api/api/ into a single /api/
  normalized = normalized.replace(/\/api\/api\//g, "/api/");

  // Auto-fallback for localhost/127.0.0.1 on live domain
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    if (/^(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)/i.test(normalized)) {
      normalized = normalized.replace(
        /^(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i,
        import.meta.env.VITE_API_URL || window.location.origin
      );
    }
  }

  // In development, rewrite absolute backend /api/uploads/ URLs to relative path to use Vite proxy
  if (import.meta.env.DEV && (normalized.startsWith("http://") || normalized.startsWith("https://"))) {
    try {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith("/api/uploads/")) {
        return parsed.pathname + parsed.search;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return normalized;
};

const PdfThumbnail = ({ fileUrl, className = "" }) => {
  const effectiveUrl = resolveEffectivePdfUrl(fileUrl);

  const [thumbnailUrl, setThumbnailUrl] = useState(() => {
    if (!effectiveUrl) return null;
    return pdfThumbnailCache.get(effectiveUrl) || (fileUrl ? pdfThumbnailCache.get(fileUrl) : null) || null;
  });
  const [loading, setLoading] = useState(!thumbnailUrl && !!effectiveUrl);
  const [hasError, setHasError] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!effectiveUrl) {
      setHasError(true);
      setLoading(false);
      return;
    }

    const cached = pdfThumbnailCache.get(effectiveUrl) || pdfThumbnailCache.get(fileUrl);
    if (cached) {
      setThumbnailUrl(cached);
      setLoading(false);
      setHasError(false);
      return;
    }

    let isCancelled = false;
    let loadingTask = null;

    const renderThumbnail = async () => {
      setLoading(true);
      setHasError(false);

      try {
        loadingTask = pdfjsLib.getDocument({
          url: effectiveUrl,
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(1);
        if (isCancelled) return;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = 360;
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: false });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        if (isCancelled) return;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        pdfThumbnailCache.set(effectiveUrl, dataUrl);
        if (fileUrl) {
          pdfThumbnailCache.set(fileUrl, dataUrl);
        }

        if (isMountedRef.current) {
          setThumbnailUrl(dataUrl);
          setLoading(false);
          setHasError(false);
        }
      } catch (err) {
        if (!isCancelled && isMountedRef.current) {
          console.warn(
            "Could not generate PDF thumbnail for:",
            effectiveUrl,
            err?.message || err
          );
          setHasError(true);
          setLoading(false);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      if (loadingTask && typeof loadingTask.destroy === "function") {
        try {
          loadingTask.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [fileUrl, effectiveUrl]);

  if (hasError || (!loading && !thumbnailUrl)) {
    return (
      <div className={`cm-wa-thumb-fallback cm-wa-thumb-pdf ${className}`}>
        <div className="cm-wa-pdf-sheet-icon">
          <FileText size={20} />
        </div>
        <span className="cm-wa-pdf-tag">PDF</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`cm-wa-thumb-loading cm-wa-thumb-pdf ${className}`}>
        <Loader2 size={16} className="cm-thumb-spinner" />
        <span className="cm-wa-thumb-loading-text">PDF</span>
      </div>
    );
  }

  return (
    <div className={`cm-wa-thumb-img-wrap ${className}`}>
      <img
        src={thumbnailUrl}
        alt="PDF Page 1 Preview"
        className="cm-wa-thumb-img cm-wa-thumb-pdf-img"
        onError={() => setHasError(true)}
      />
      <span className="cm-wa-thumb-pdf-badge">PDF</span>
    </div>
  );
};

export default React.memo(PdfThumbnail);
