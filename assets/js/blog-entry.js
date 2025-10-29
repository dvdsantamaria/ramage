document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector("[data-blog-entry]");
  if (!container) return;

  const slug = container.getAttribute("data-blog-entry");
  const target = container.querySelector(".blog-entry-body");
  if (!slug || !target) return;

  const titleEls = Array.from(container.querySelectorAll("[data-blog-title]"));
  const excerptEls = Array.from(
    container.querySelectorAll("[data-blog-excerpt]"),
  );
  const initialTitles = titleEls.map((el) => el.textContent);
  const initialExcerpts = excerptEls.map((el) => el.textContent);

  titleEls.forEach((el) => (el.textContent = ""));
  excerptEls.forEach((el) => (el.textContent = ""));

  const rootAttr = container.getAttribute("data-blog-root") || ".";
  const normalizedRoot =
    rootAttr === "." ? "" : rootAttr.endsWith("/") ? rootAttr : `${rootAttr}/`;

  const markdownUrl = new URL(
    `${normalizedRoot}${slug}.md`,
    document.baseURI,
  ).href;
  const metaUrl = new URL(`${normalizedRoot}meta.json`, document.baseURI).href;

  const prevLink = container.querySelector("[data-blog-prev]");
  const nextLink = container.querySelector("[data-blog-next]");

  let titlePopulated = false;
  let excerptPopulated = false;

  const applyTitle = (value) => {
    if (typeof value !== "string") return;
    titleEls.forEach((el) => (el.textContent = value));
    titlePopulated = true;
  };

  const applyExcerpt = (value) => {
    if (typeof value !== "string") return;
    excerptEls.forEach((el) => (el.textContent = value));
    excerptPopulated = true;
  };

  loadJson(metaUrl)
    .then((meta) => {
      if (!Array.isArray(meta) || !meta.length) return;

      const orderedEntries = meta
        .filter((entry) => entry && entry.slug)
        .map((entry, index) => ({
          entry,
          order: Number.isFinite(entry.id) ? entry.id : index,
        }))
        .sort((a, b) => a.order - b.order)
        .map((item) => item.entry);

      if (!orderedEntries.length) return;

      const currentIndex = orderedEntries.findIndex(
        (entry) => entry.slug === slug,
      );
      if (currentIndex === -1) return;

      const currentEntry = orderedEntries[currentIndex];
      if (!currentEntry || !currentEntry.slug) return;

      if (currentEntry.title) {
        applyTitle(currentEntry.title);
      }
      if (currentEntry.excerpt) {
        applyExcerpt(currentEntry.excerpt);
      }

      if (prevLink && orderedEntries.length > 1) {
        const prevIndex =
          (currentIndex - 1 + orderedEntries.length) % orderedEntries.length;
        const prevEntry = orderedEntries[prevIndex];
        if (prevEntry && prevEntry.slug) {
          prevLink.href = `${normalizedRoot}${prevEntry.slug}.html`;
          prevLink.dataset.blogPrevSlug = prevEntry.slug;
        }
      }

      if (nextLink && orderedEntries.length > 1) {
        const nextIndex =
          (currentIndex + 1) % orderedEntries.length;
        const nextEntry = orderedEntries[nextIndex];
        if (nextEntry && nextEntry.slug) {
          nextLink.href = `${normalizedRoot}${nextEntry.slug}.html`;
          nextLink.dataset.blogNextSlug = nextEntry.slug;
        }
      }

      const currentSlug = currentEntry.slug;
      if (prevLink && (!prevLink.dataset.blogPrevSlug || !prevLink.dataset.blogPrevSlug.trim())) {
        prevLink.href = `${normalizedRoot}${currentSlug}.html`;
        prevLink.dataset.blogPrevSlug = currentSlug;
      }
      if (nextLink && (!nextLink.dataset.blogNextSlug || !nextLink.dataset.blogNextSlug.trim())) {
        nextLink.href = `${normalizedRoot}${currentSlug}.html`;
        nextLink.dataset.blogNextSlug = currentSlug;
      }
    })
    .catch((error) => {
      console.error("Failed to load blog metadata", error);
    });

  loadMarkdown(markdownUrl)
    .then((markdown) => {
      target.innerHTML = renderMarkdown(markdown);

      const firstHeading = target.querySelector("h1, h2");
      const firstParagraph = target.querySelector("p");

      if (!titlePopulated && firstHeading) {
        applyTitle(firstHeading.textContent.trim());
        firstHeading.remove();
      }

      if (!excerptPopulated && firstParagraph) {
        applyExcerpt(firstParagraph.textContent.trim());
        firstParagraph.remove();
      }
    })
    .catch((error) => {
      console.error(error);
      titleEls.forEach(
        (el, index) => (el.textContent = initialTitles[index] || ""),
      );
      excerptEls.forEach(
        (el, index) => (el.textContent = initialExcerpts[index] || ""),
      );
      target.innerHTML =
        "<p>We are preparing this article. Please check back soon.</p>";
    });
});

function renderMarkdown(markdown) {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";

      if (/^#{1,6}\s/.test(trimmed)) {
        const [, hashes, content] = trimmed.match(/^(#{1,6})\s+(.*)$/);
        const level = Math.min(hashes.length, 6);
        return `<h${level}>${escapeHtml(content)}</h${level}>`;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        const items = trimmed
          .split(/\n/)
          .map((line) =>
            line.replace(/^[-*]\s+/, "").trim()
          )
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("\n");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadMarkdown(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load blog content: ${response.status}`);
      }
      return response.text();
    })
    .catch((error) => {
      if (window.location.protocol === "file:") {
        return loadMarkdownFromIframe(url);
      }
      throw error;
    });
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
