// Mobile nav toggle. No framework needed for a site this size.
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
// page instead of being redirected, and see a plain status message.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  const status = document.querySelector("#form-status");
  if (!form || !status) return;

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
