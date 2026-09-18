// Mobile nav toggle.
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }
});

// Contact form: submit to Web3Forms via fetch so visitors stay on the
// page and see a plain status message instead of being redirected.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  const status = document.querySelector("#form-status");
  if (!form || !status) return;

  const accessKey = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG.web3formsAccessKey) || "";
  if (!accessKey) {
    form.querySelector("input[name='access_key']").value = "";
    form.querySelectorAll("input, textarea, button").forEach((el) => (el.disabled = true));
    status.textContent = "Formuläret aktiveras inom kort.";
    return;
  }
  form.querySelector("input[name='access_key']").value = accessKey;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    status.textContent = "Skickar...";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        status.textContent = "Tack, ditt meddelande är skickat.";
        form.reset();
        form.querySelector("input[name='access_key']").value = accessKey;
      } else {
        status.textContent = "Något gick fel. Prova gärna igen.";
      }
    } catch (error) {
      status.textContent = "Något gick fel. Prova gärna igen.";
    } finally {
      submitButton.disabled = false;
    }
  });
});

// Upcoming events: rendered from events.json so the board can update
// them from the admin page without touching any HTML.
document.addEventListener("DOMContentLoaded", async () => {
  const fullList = document.querySelector("#events-list");
  const preview = document.querySelector("#events-preview");
  if (!fullList && !preview) return;

  const emptyMarkup = `
    <div class="card empty-state">
      <p>Inga evenemang är inplanerade just nu. Nya tillfällen läggs upp löpande, så håll utkik här.</p>
    </div>`;

  const PREVIEW_LENGTH = 140;

  // Truncates already-rendered HTML at a text-character boundary without
  // ever cutting inside a tag: walks the DOM (not the markup string), so
  // bold, italic, links, and list items still render correctly in the
  // shortened preview, and a partly-shown list just has fewer <li>s rather
  // than broken markup.
  const truncateHtml = (html, maxLength) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    const state = { remaining: maxLength, truncated: false };

    const walk = (node) => {
      if (state.remaining <= 0) return false; // caller should remove this node

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.length <= state.remaining) {
          state.remaining -= text.length;
          return true;
        }
        const lastSpace = text.lastIndexOf(" ", state.remaining);
        const cut = lastSpace > 20 ? lastSpace : state.remaining;
        node.textContent = text.slice(0, cut) + "…";
        state.remaining = 0;
        state.truncated = true;
        return true;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach((child) => {
          if (state.remaining <= 0) {
            node.removeChild(child);
            state.truncated = true;
          } else if (!walk(child)) {
            node.removeChild(child);
          }
        });
      }
      return true;
    };

    walk(container);
    return { html: container.innerHTML, truncated: state.truncated };
  };

  const eventCard = (event, index) => {
    const fullHtml = renderRichText(event.description || "");
    const { html: previewHtml, truncated } = truncateHtml(fullHtml, PREVIEW_LENGTH);
    const uid = `event-desc-${index}`;

    const descriptionMarkup = truncated
      ? `
        <div class="event-description" id="${uid}-preview">${previewHtml}</div>
        <div class="event-description" id="${uid}-full" hidden>${fullHtml}</div>
        <button type="button" class="link-button" data-action="toggle-description" data-target="${uid}" aria-expanded="false" aria-controls="${uid}-full">Läs mer</button>`
      : `<div class="event-description">${fullHtml}</div>`;

    return `
    <div class="card">
      <p class="eyebrow">${escapeHtml(event.date || "")}</p>
      <h3>${escapeHtml(event.title || "")}</h3>
      ${descriptionMarkup}
      ${
        event.link
          ? `<a class="button small secondary mt-sm" href="${escapeHtml(event.link)}" target="_blank" rel="noopener">Anmäl dig</a>`
          : ""
      }
    </div>`;
  };

  const handleToggleDescription = (event) => {
    const btn = event.target.closest('[data-action="toggle-description"]');
    if (!btn) return;
    const uid = btn.dataset.target;
    const previewEl = document.getElementById(`${uid}-preview`);
    const fullEl = document.getElementById(`${uid}-full`);
    if (!previewEl || !fullEl) return;
    const wasHidden = fullEl.hidden;
    fullEl.hidden = !wasHidden;
    previewEl.hidden = wasHidden;
    btn.textContent = wasHidden ? "Visa mindre" : "Läs mer";
    btn.setAttribute("aria-expanded", String(wasHidden));
  };

  if (fullList) fullList.addEventListener("click", handleToggleDescription);
  if (preview) preview.addEventListener("click", handleToggleDescription);

  try {
    const response = await fetch("events.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Kunde inte hämta evenemang");
    const events = await response.json();

    if (fullList) {
      fullList.innerHTML = events.length ? events.map(eventCard).join("") : emptyMarkup;
    }
    if (preview) {
      const upcoming = events.slice(0, 3);
      preview.innerHTML = upcoming.length ? upcoming.map(eventCard).join("") : emptyMarkup;
    }
  } catch (error) {
    const errorMarkup = `
      <div class="card empty-state">
        <p>Evenemangen kunde inte laddas just nu.</p>
      </div>`;
    if (fullList) fullList.innerHTML = errorMarkup;
    if (preview) preview.innerHTML = errorMarkup;
  }
});

// Board members: rendered from board.json. Falls back to a monogram when
// a member has no photo yet.
document.addEventListener("DOMContentLoaded", async () => {
  const list = document.querySelector("#board-list");
  if (!list) return;

  const initials = (name) =>
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const memberRow = (member) => {
    const zoom = Number(member.photoZoom) > 0 ? Number(member.photoZoom) : 1;
    const posX = Number.isFinite(Number(member.photoX)) ? Number(member.photoX) : 50;
    const posY = Number.isFinite(Number(member.photoY)) ? Number(member.photoY) : 50;
    return `
    <div class="board-member">
      ${
        member.photo
          ? `<div class="board-photo"><img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name || "")}" style="object-position:${posX}% ${posY}%; transform:scale(${zoom});"></div>`
          : `<div class="board-initial">${escapeHtml(initials(member.name))}</div>`
      }
      <div>
        <div class="role">${escapeHtml(member.role || "")}</div>
        <div>${escapeHtml(member.name || "")}</div>
      </div>
    </div>`;
  };

  try {
    const response = await fetch("board.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Kunde inte hämta styrelsen");
    const board = await response.json();
    list.innerHTML = board.length
      ? board.map(memberRow).join("")
      : "<p>Styrelsen publiceras här inom kort.</p>";
  } catch (error) {
    list.innerHTML = "<p>Styrelsen kunde inte laddas just nu.</p>";
  }
});

// Sponsors: rendered from sponsors.json as a plain logo strip.
document.addEventListener("DOMContentLoaded", async () => {
  const list = document.querySelector("#sponsors-list");
  if (!list) return;

  const logo = (sponsor) => {
    const img = `<img src="${escapeHtml(sponsor.logo)}" alt="${escapeHtml(sponsor.name || "")}">`;
    return sponsor.url
      ? `<a href="${escapeHtml(sponsor.url)}" target="_blank" rel="noopener">${img}</a>`
      : img;
  };

  try {
    const response = await fetch("sponsors.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Kunde inte hämta sponsorer");
    const sponsors = await response.json();
    list.innerHTML = sponsors.length
      ? `<div class="sponsor-strip">${sponsors.map(logo).join("")}</div>`
      : `<p class="empty-state">Vi bygger just nu upp vårt sponsornätverk. Vill ditt företag synas här? <a href="kontakt.html">Hör av dig till oss.</a></p>`;
  } catch (error) {
    list.innerHTML = `<p class="empty-state">Sponsorerna kunde inte laddas just nu.</p>`;
  }
});

// escapeHtml and renderRichText live in richtext.js, loaded before this file.
