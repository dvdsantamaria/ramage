document.addEventListener("DOMContentLoaded", () => {
  const listing = document.querySelector("[data-blog-listing]");
  if (!listing) return;

  const cards = Array.from(listing.querySelectorAll("[data-blog-slug]"));
  if (!cards.length) return;

  const rootAttr = listing.getAttribute("data-blog-root") || "./blog/";
  const normalizedRoot = normalizeRelativeRoot(rootAttr);
  const assetRootAttr = listing.getAttribute("data-blog-asset-root") || "";
  const assetRoot = normalizeAssetRoot(assetRootAttr);

  const metaUrl = new URL(
    `${normalizedRoot}meta.json`,
    document.baseURI,
  ).href;

  loadJson(metaUrl)
    .then((meta) => {
      if (!Array.isArray(meta) || !meta.length) return;

      const metaBySlug = new Map(
        meta
          .filter((entry) => entry && entry.slug)
          .map((entry) => [entry.slug, entry]),
      );

      cards.forEach((card) => {
        const slug = card.getAttribute("data-blog-slug");
        if (!slug) return;

        const entry = metaBySlug.get(slug);
        if (!entry) return;

        const imageEl =
          card.querySelector("[data-blog-card-image]") ||
          card.querySelector("img");

        if (entry.image && imageEl) {
          const resolvedImage = resolveAssetPath(entry.image, assetRoot);
          if (resolvedImage && imageEl.getAttribute("src") !== resolvedImage) {
            imageEl.src = resolvedImage;
          }
        }

        const titleEl = card.querySelector("h3");
        if (entry.title && titleEl) {
          titleEl.textContent = entry.title;
        }

        const excerptEl = card.querySelector("p");
        if (entry.excerpt && excerptEl) {
          excerptEl.textContent = entry.excerpt;
        }

        const linkEl = card.querySelector("a");
        if (linkEl) {
          if (entry.title) {
            linkEl.dataset.blogTitle = entry.title;
          }
          if (entry.excerpt) {
            linkEl.dataset.blogExcerpt = entry.excerpt;
          }
        }
      });
    })
    .catch((error) => {
      console.error("Failed to populate blog listing", error);
    });
});

function normalizeRelativeRoot(value) {
  if (!value || value === ".") return "";
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeAssetRoot(value) {
  if (!value || value === ".") return "";
  if (value === "./") return "./";
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveAssetPath(path, assetRoot) {
  if (!path) return "";
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  if (assetRoot) {
    if (path.startsWith("./")) {
      return assetRoot + path.replace(/^\.\//, "");
    }

    if (path.startsWith("../")) {
      return path;
    }

    return assetRoot + path;
  }

  return path.startsWith("./") ? path.replace(/^\.\//, "") : path;
}

function loadJson(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load blog metadata: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      if (window.location.protocol === "file:") {
        return loadMarkdownFromIframe(url).then((text) => {
          try {
            return JSON.parse(text);
          } catch (parseError) {
            throw new Error("Failed to parse blog metadata JSON");
          }
        });
      }
      throw error;
    });
}

function loadMarkdownFromIframe(url) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const text = doc.body ? doc.body.textContent : "";
        iframe.remove();
        if (!text) {
          reject(new Error("Markdown iframe returned empty content"));
          return;
        }
        resolve(text);
      } catch (err) {
        iframe.remove();
        reject(err);
      }
    };

    const handleError = (err) => {
      iframe.remove();
      reject(err || new Error("Failed to load markdown iframe"));
    };

    iframe.addEventListener("load", handleLoad, { once: true });
    iframe.addEventListener("error", handleError, { once: true });
    document.body.appendChild(iframe);
  });
}
