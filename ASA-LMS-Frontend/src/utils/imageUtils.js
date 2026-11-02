export const getApiBase = () => {
  let envBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
  // Auto-fallback when running on live production domain
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    if (!envBase || /localhost|127\.0\.0\.1/i.test(envBase)) {
      envBase = window.location.origin;
    }
  }
  return envBase.replace(/\/api\/?$/, "").replace(/\/+$/, "");
};

/**
 * Normalizes image URLs inside HTML content (such as CKEditor output),
 * replacing obsolete/hardcoded localhost, 127.0.0.1, internal IIS proxy ports,
 * or relative URLs with the active API host, ensuring CORS-enabled /api/ endpoints.
 */
export const normalizeCKEditorImages = (html) => {
  if (!html || typeof html !== "string") return html || "";

  const apiBase = getApiBase();
  const targetCkeditor = apiBase
    ? `${apiBase}/api/ckeditor-upload-images/`
    : "/api/ckeditor-upload-images/";
  const targetUploads = apiBase
    ? `${apiBase}/api/uploads/`
    : "/api/uploads/";

  // Replace any ckeditor-upload-images occurrence (with any preceding host/proto/port/api)
  let updated = html.replace(
    /(?:https?:)?(?:\/\/)?(?:[a-zA-Z0-9.-]+(?::\d+)?)?(?:\/api)?\/ckeditor-upload-images\/([^\s"'<>?#]+)/gi,
    `${targetCkeditor}$1`
  );

  // Replace any uploads occurrence (with any preceding host/proto/port/api)
  updated = updated.replace(
    /(?:https?:)?(?:\/\/)?(?:[a-zA-Z0-9.-]+(?::\d+)?)?(?:\/api)?\/uploads\/([^\s"'<>?#]+)/gi,
    `${targetUploads}$1`
  );

  return updated;
};

/**
 * Normalizes a single image URL.
 */
export const normalizeImageUrl = (url) => {
  if (!url || typeof url !== "string") return url || "";

  const apiBase = getApiBase();
  const targetCkeditor = apiBase
    ? `${apiBase}/api/ckeditor-upload-images/`
    : "/api/ckeditor-upload-images/";
  const targetUploads = apiBase
    ? `${apiBase}/api/uploads/`
    : "/api/uploads/";

  const ckMatch = url.match(/ckeditor-upload-images\/([^\s"'<>?#]+)/i);
  if (ckMatch) {
    return `${targetCkeditor}${ckMatch[1]}`;
  }

  const uploadMatch = url.match(/uploads\/([^\s"'<>?#]+)/i);
  if (uploadMatch) {
    return `${targetUploads}${uploadMatch[1]}`;
  }

  return url;
};

/**
 * Extracts all <img> src attributes from an HTML string.
 */
export const extractImagesFromHtml = (html) => {
  if (!html || typeof html !== "string") return [];

  const normalized = normalizeCKEditorImages(html);
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  const matches = [];
  let match;

  while ((match = regex.exec(normalized)) !== null) {
    if (match[1]) {
      matches.push(normalizeImageUrl(match[1]));
    }
  }

  return matches;
};
