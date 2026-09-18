// Shared between main.js (renders event descriptions on the site) and
// admin.js (renders the live preview while editing). Kept in one file so
// the two never drift apart.

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

// Minimal markdown-style formatting for event descriptions: **bold**,
// *italic*, [text](url), "- " or "* " bullet lists, and line breaks.
// Escapes the raw text first, so the only HTML that can ever appear is
// what this function writes itself. Safe by construction regardless of
// what's typed into the admin field.
function renderRichText(text) {
  const inline = (line) => {
    let out = line;
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return out;
  };

  const parts = [];
  let listItems = null;
  const flushList = () => {
    if (listItems) {
      parts.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      listItems = null;
    }
  };

  escapeHtml(text || "")
    .split("\n")
    .forEach((line) => {
      const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (listMatch) {
        listItems = listItems || [];
        listItems.push(inline(listMatch[1]));
        return;
      }
      flushList();
      parts.push(inline(line));
    });
  flushList();

  return parts.join("<br>");
}
