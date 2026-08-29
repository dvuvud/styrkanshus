// Content admin page: lets a logged-in GitHub collaborator edit events,
// the board list, and sponsor logos, and publish straight to the repo —
// no code, no going through anyone else.
//
// Auth: GitHub OAuth (Authorization Code flow). The one step that can't
// happen in the browser — exchanging the code for a token, since GitHub's
// token endpoint has no CORS support — is delegated to a same-origin
// Cloudflare Pages Function (see functions/api/oauth-token.js). Everything
// else talks to api.github.com directly, which does support CORS for
// authenticated requests.
//
// Access control: anyone with a GitHub account can log in, but only
// accounts with write access to this repository can actually publish —
// GitHub itself rejects the save otherwise. There's no separate password
// or allowlist to maintain here.

const TOKEN_KEY = "styrkanshus_admin_token";
const root = document.querySelector("#admin-root");

const SECTIONS = {
  events: {
    label: "Evenemang",
    singular: "Evenemang",
    path: "frontend/events.json",
    addLabel: "Lägg till evenemang",
    emptyLabel: "Inga evenemang inlagda ännu.",
    fields: [
      { key: "date", label: "Datum", type: "text", placeholder: "t.ex. 12 sep 2026" },
      { key: "title", label: "Namn", type: "text", placeholder: "Namn på evenemang" },
      { key: "description", label: "Beskrivning", type: "textarea", placeholder: "Vad händer, var och för vem?" },
    ],
  },
  board: {
    label: "Styrelsen",
    singular: "Styrelsemedlem",
    path: "frontend/board.json",
    addLabel: "Lägg till styrelsemedlem",
    emptyLabel: "Ingen styrelse inlagd ännu.",
    fields: [
      { key: "name", label: "Namn", type: "text", placeholder: "Namn" },
      { key: "role", label: "Roll", type: "text", placeholder: "t.ex. Ordförande" },
      { key: "photo", label: "Foto", type: "image", dir: "images/board" },
    ],
  },
  sponsors: {
    label: "Sponsorer",
    singular: "Sponsor",
    path: "frontend/sponsors.json",
    addLabel: "Lägg till sponsor",
    emptyLabel: "Inga sponsorer inlagda ännu.",
    fields: [
      { key: "name", label: "Namn", type: "text", placeholder: "Företagsnamn" },
      { key: "url", label: "Webbplats (valfritt)", type: "text", placeholder: "https://…" },
      { key: "logo", label: "Logotyp", type: "image", dir: "images/sponsors" },
    ],
  },
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const state = {
  user: null,
  tab: "events",
  data: {
    events: { items: [], sha: null },
    board: { items: [], sha: null },
    sponsors: { items: [], sha: null },
  },
};

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

function githubAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: SITE_CONFIG.githubOAuthClientId,
    scope: "repo",
    redirect_uri: redirectUri(),
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function ghApi(path, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function setStatus(text, kind) {
  const status = document.querySelector("#admin-status");
  if (!status) return;
  status.textContent = text;
  status.className = kind ? `mt-sm ${kind}` : "mt-sm";
}

// ---------- Views ----------

function renderNotConfigured() {
  root.innerHTML = `
    <div class="card admin-card text-center">
      <p class="eyebrow">StyrkansHus</p>
      <h1 style="font-size:1.6rem;">Admin ej konfigurerad</h1>
      <p>Fyll i <code>githubOAuthClientId</code> i <code>frontend/js/config.js</code> och sätt <code>GITHUB_CLIENT_ID</code>/<code>GITHUB_CLIENT_SECRET</code> som miljövariabler på Cloudflare Pages-projektet för att aktivera inloggning. Se README.md.</p>
    </div>`;
}

function renderLoggedOut(message) {
  root.innerHTML = `
    <div class="card admin-card text-center">
      <p class="eyebrow">StyrkansHus</p>
      <h1 style="font-size:1.6rem;">Redigera innehåll</h1>
      <p>Logga in med ett GitHub-konto som har skrivbehörighet till repot för att redigera evenemang, styrelsen och sponsorer.</p>
      ${message ? `<p id="admin-status" class="error">${escapeHtml(message)}</p>` : ""}
      <a class="button" href="${githubAuthorizeUrl()}">Logga in med GitHub</a>
    </div>`;
}

function renderLoading(text) {
  root.innerHTML = `
    <div class="card admin-card text-center">
      <p class="eyebrow">StyrkansHus</p>
      <h1 style="font-size:1.6rem;">${escapeHtml(text || "Laddar…")}</h1>
    </div>`;
}

function fieldMarkup(tab, item, index, field) {
  if (field.type === "textarea") {
    return `
      <label>${field.label}</label>
      <textarea rows="3" data-action="edit-field" data-tab="${tab}" data-field="${field.key}" data-index="${index}" placeholder="${escapeHtml(field.placeholder)}">${escapeHtml(item[field.key])}</textarea>`;
  }

  if (field.type === "image") {
    const previewUrl =
      item[`_${field.key}PreviewUrl`] ||
      (item[field.key]
        ? `https://raw.githubusercontent.com/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/main/frontend/${item[field.key]}`
        : "");
    return `
      <label>${field.label}</label>
      <div class="image-field">
        <div class="image-thumb">${previewUrl ? `<img src="${previewUrl}" alt="">` : ""}</div>
        <div>
          <input type="file" accept="image/*" data-action="upload-image" data-tab="${tab}" data-field="${field.key}" data-index="${index}">
          ${item[`_${field.key}Uploading`] ? '<p class="upload-status">Laddar upp…</p>' : ""}
          ${item[field.key] ? `<button type="button" class="link-button" data-action="remove-image" data-tab="${tab}" data-field="${field.key}" data-index="${index}">Ta bort bild</button>` : ""}
        </div>
      </div>`;
  }

  return `
    <label>${field.label}</label>
    <input type="text" data-action="edit-field" data-tab="${tab}" data-field="${field.key}" data-index="${index}" value="${escapeHtml(item[field.key])}" placeholder="${escapeHtml(field.placeholder)}">`;
}

function rowMarkup(tab, config, item, index) {
  const titleField = config.fields[0].key;
  return `
    <div class="event-row">
      <div class="event-row-head">
        <span>${escapeHtml(item[titleField]) || `${config.singular} ${index + 1}`}</span>
        <button type="button" class="link-button" data-action="remove-row" data-tab="${tab}" data-index="${index}">Ta bort</button>
      </div>
      ${config.fields.map((field) => fieldMarkup(tab, item, index, field)).join("")}
    </div>`;
}

function renderRows() {
  const config = SECTIONS[state.tab];
  const items = state.data[state.tab].items;
  if (!items.length) return `<p class="empty-state">${config.emptyLabel}</p>`;
  return items.map((item, index) => rowMarkup(state.tab, config, item, index)).join("");
}

function renderEditor() {
  const tabsHtml = Object.entries(SECTIONS)
    .map(
      ([key, config]) => `
      <button type="button" class="tab-button ${state.tab === key ? "active" : ""}" data-action="switch-tab" data-tab="${key}">${config.label}</button>`
    )
    .join("");

  root.innerHTML = `
    <div class="admin-editor">
      <div class="admin-topbar">
        <div>
          <p class="eyebrow">StyrkansHus</p>
          <h1 style="font-size:1.6rem; margin:0;">Redigera innehåll</h1>
        </div>
        <div class="text-center">
          <p class="admin-user" style="margin:0;">Inloggad som ${escapeHtml(state.user.login)}</p>
          <button type="button" class="link-button" data-action="logout">Logga ut</button>
        </div>
      </div>

      <div class="admin-tabs">${tabsHtml}</div>

      <div id="section-rows" class="mt-lg">${renderRows()}</div>

      <div class="hero-actions">
        <button type="button" class="button secondary small" data-action="add-row">${SECTIONS[state.tab].addLabel}</button>
        <button type="button" class="button small" data-action="save-section">Spara ${SECTIONS[state.tab].label.toLowerCase()}</button>
      </div>
      <p id="admin-status" class="mt-sm"></p>
    </div>`;
}

// ---------- Actions ----------

async function handleImageUpload(tab, index, field, file) {
  if (file.size > MAX_IMAGE_BYTES) {
    setStatus("Bilden är för stor (max 5 MB). Välj en mindre bild.", "error");
    return;
  }

  const config = SECTIONS[tab];
  const fieldConfig = config.fields.find((f) => f.key === field);
  const item = state.data[tab].items[index];
  item[`_${field}PreviewUrl`] = URL.createObjectURL(file);
  item[`_${field}Uploading`] = true;
  renderEditor();

  try {
    const base64 = await fileToBase64(file);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const slug =
      (item.name || fieldConfig.dir.split("/").pop() || "bild")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "bild";
    const path = `${fieldConfig.dir}/${Date.now()}-${slug}.${ext}`;

    const response = await ghApi(
      `/repos/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/contents/frontend/${path}`,
      {
        method: "PUT",
        body: JSON.stringify({ message: `Ladda upp bild: ${path}`, content: base64, branch: "main" }),
      }
    );
    if (!response.ok) throw new Error("upload failed");
    item[field] = path;
  } catch (error) {
    setStatus("Bilduppladdningen misslyckades. Försök igen.", "error");
  } finally {
    item[`_${field}Uploading`] = false;
    renderEditor();
  }
}

async function saveSection(tab) {
  const config = SECTIONS[tab];
  const saveButton = document.querySelector("[data-action='save-section']");
  if (saveButton) saveButton.disabled = true;
  setStatus("Sparar…", "");

  try {
    const cleanItems = state.data[tab].items.map((item) => {
      const clean = {};
      config.fields.forEach((field) => (clean[field.key] = item[field.key] || ""));
      return clean;
    });
    const content = utf8ToBase64(JSON.stringify(cleanItems, null, 2) + "\n");
    const response = await ghApi(`/repos/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/contents/${config.path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Uppdatera ${config.label.toLowerCase()}`,
        content,
        sha: state.data[tab].sha || undefined,
        branch: "main",
      }),
    });

    if (response.status === 401) {
      clearToken();
      renderLoggedOut("Din session har gått ut. Logga in igen.");
      return;
    }
    if (response.status === 403) {
      setStatus("Du är inloggad men saknar behörighet att publicera ändringar i det här repot.", "error");
      return;
    }
    if (!response.ok) throw new Error(`GitHub svarade ${response.status}`);

    const data = await response.json();
    state.data[tab].sha = data.content.sha;
    setStatus("Sparat! Sidan uppdateras inom någon minut.", "success");
  } catch (error) {
    setStatus("Något gick fel när ändringarna skulle sparas. Försök igen.", "error");
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

// ---------- Event delegation (bound once; innerHTML is replaced on render) ----------

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, tab, field } = target.dataset;
  const index = target.dataset.index !== undefined ? Number(target.dataset.index) : undefined;

  if (action === "logout") {
    clearToken();
    boot();
  } else if (action === "switch-tab") {
    state.tab = tab;
    renderEditor();
  } else if (action === "add-row") {
    const config = SECTIONS[state.tab];
    const blank = {};
    config.fields.forEach((f) => (blank[f.key] = ""));
    state.data[state.tab].items.push(blank);
    renderEditor();
  } else if (action === "remove-row") {
    state.data[tab].items.splice(index, 1);
    renderEditor();
  } else if (action === "remove-image") {
    state.data[tab].items[index][field] = "";
    delete state.data[tab].items[index][`_${field}PreviewUrl`];
    renderEditor();
  } else if (action === "save-section") {
    saveSection(state.tab);
  }
});

root.addEventListener("input", (event) => {
  const el = event.target;
  if (el.dataset.action !== "edit-field") return;
  state.data[el.dataset.tab].items[Number(el.dataset.index)][el.dataset.field] = el.value;
});

root.addEventListener("change", (event) => {
  const el = event.target;
  if (el.dataset.action !== "upload-image" || !el.files[0]) return;
  handleImageUpload(el.dataset.tab, Number(el.dataset.index), el.dataset.field, el.files[0]);
});

// ---------- Boot ----------

async function loadEditor() {
  renderLoading("Hämtar innehåll…");

  const userResponse = await ghApi("/user");
  if (userResponse.status === 401) {
    clearToken();
    renderLoggedOut("Din session har gått ut. Logga in igen.");
    return;
  }
  const user = await userResponse.json();

  for (const tab of Object.keys(SECTIONS)) {
    const config = SECTIONS[tab];
    const response = await ghApi(`/repos/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/contents/${config.path}`);
    if (response.status === 200) {
      const data = await response.json();
      state.data[tab] = { items: JSON.parse(base64ToUtf8(data.content) || "[]"), sha: data.sha };
    } else if (response.status === 404) {
      state.data[tab] = { items: [], sha: null };
    } else {
      renderLoggedOut(`Kunde inte läsa ${config.path} från GitHub. Försök igen.`);
      return;
    }
  }

  state.user = user;
  renderEditor();
}

async function exchangeCodeForToken(code) {
  renderLoading("Loggar in…");
  try {
    const response = await fetch("/api/oauth-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!data.access_token) {
      renderLoggedOut(data.error_description || "Inloggningen misslyckades. Försök igen.");
      return;
    }
    setToken(data.access_token);
    window.history.replaceState({}, document.title, redirectUri());
    await loadEditor();
  } catch (error) {
    renderLoggedOut("Inloggningen misslyckades. Försök igen.");
  }
}

async function boot() {
  if (!SITE_CONFIG?.githubOAuthClientId) {
    renderNotConfigured();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    await exchangeCodeForToken(code);
    return;
  }

  if (!getToken()) {
    renderLoggedOut();
    return;
  }

  await loadEditor();
}

boot();
