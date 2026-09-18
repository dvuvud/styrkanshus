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

  const eventCard = (event) => `
    <div class="card">
      <p class="eyebrow">${escapeHtml(event.date || "")}</p>
      <h3>${escapeHtml(event.title || "")}</h3>
      <div class="event-description">${renderRichText(event.description || "")}</div>
      ${
        event.link
          ? `<a class="button small secondary mt-sm" href="${escapeHtml(event.link)}" target="_blank" rel="noopener">Anmäl dig</a>`
          : ""
      }
    </div>`;

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
