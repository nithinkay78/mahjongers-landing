// Mobile menu: below 720px the nav links are hidden, so add a Menu button to the
// header that opens a panel with the main pages. Shared by every page.
(function () {
  const header = document.querySelector("header.nav");
  if (!header) return;

  const links = [
    ["/", "Home"],
    ["/website-design", "Website design"],
    ["/social-media", "Social media"],
    ["/blog", "Blog"],
    ["/join", "Book a discovery call"]
  ];

  const style = document.createElement("style");
  style.textContent = `
    .mj-menu-btn { display: none; align-items: center; justify-content: center; gap: 6px; width: 44px; height: 44px; padding: 0; margin-left: 8px; flex-shrink: 0;
      border: 1px solid rgba(36,29,24,0.12); border-radius: 999px; background: rgba(255,255,255,0.75); color: #241D18;
      font: 700 14px 'Manrope', sans-serif; cursor: pointer; }
    .mj-menu-btn svg { width: 18px; height: 18px; }
    .mj-menu { display: none; position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 60;
      background: rgba(255,255,255,0.97); border: 1px solid rgba(36,29,24,0.08); border-radius: 20px;
      box-shadow: 0 18px 44px rgba(36,29,24,0.16); padding: 8px; }
    .mj-menu a { display: flex; align-items: center; min-height: 48px; padding: 0 16px; border-radius: 14px;
      font: 700 16px 'Manrope', sans-serif; color: #241D18; text-decoration: none; }
    .mj-menu a:hover, .mj-menu a[aria-current="page"] { background: rgba(238,138,95,0.12); color: #B5502C; }
    .mj-menu a:last-child { margin-top: 6px; justify-content: center; color: #FFFFFF;
      background: linear-gradient(120deg, #FF8A4D, #F04E7C 60%, #C445B8); }
    .mj-menu.open { display: block; }
    @media (max-width: 720px) {
      .mj-menu-btn { display: inline-flex; }
      header.nav, header.nav > nav { flex-wrap: nowrap; }
      header.nav .cta-gradient, header.nav .nav-link { white-space: nowrap; }
    }
    @media (min-width: 721px) { .mj-menu { display: none !important; } }
  `;
  document.head.appendChild(style);

  // A div, not <nav>: pages style "header nav" for their own link row.
  const panel = document.createElement("div");
  panel.className = "mj-menu";
  panel.id = "mj-menu";
  panel.setAttribute("role", "navigation");
  panel.setAttribute("aria-label", "Main menu");
  const here = location.pathname.replace(/\/$/, "") || "/";
  for (const [href, label] of links) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (href === here || (href === "/blog" && here.startsWith("/blog/"))) a.setAttribute("aria-current", "page");
    panel.appendChild(a);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mj-menu-btn";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "mj-menu");
  button.setAttribute("aria-label", "Menu");
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  const setOpen = (open) => {
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) { setOpen(false); button.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) setOpen(false);
  });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });

  // Sit next to the page's own call-to-action when the header has an inner <nav>.
  (header.querySelector("nav") || header).appendChild(button);
  header.appendChild(panel);
})();
