document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector("[data-blog-entry]");
  if (!container) return;

  const slug = container.getAttribute("data-blog-entry");
  const target = container.querySelector(".blog-entry-body");
  if (!slug || !target) return;

  const rootAttr = container.getAttribute("data-blog-root") || ".";
  const normalizedRoot =
    rootAttr === "." ? "" : rootAttr.endsWith("/") ? rootAttr : `${rootAttr}/`;
  const url = new URL(`${normalizedRoot}${slug}.md`, document.baseURI).href;

  loadMarkdown(url)
    .then((markdown) => {
      target.innerHTML = renderMarkdown(markdown);
    })
    .catch((error) => {
      console.error(error);
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

function loadMarkdownFromIframe(url) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const text = doc.body ? doc.body.innerText : "";
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
