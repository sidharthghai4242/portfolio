# Sidharth Ghai Portfolio

A responsive, dependency-free portfolio aligned with Sidharth Ghai's current résumé. Forest, ivory, and lime art direction, with a custom canvas network globe. No framework, build step, analytics, or backend is required.

## Features

- Interactive network globe with pointer response, animated connections, and tap pulses.
- PathPilot AI and WaveSched AI with screenshots captured from the actual public demos, category filters, project dialogs, live links and source links.
- Updated Oracle experience covering Design Studio modeling, UIM/NI cartridges, Java services, development automation, migration and production troubleshooting.
- Oracle Young Leader Award recognition for FY26 Q2 and FY27 Q1.
- Quick navigation: `Ctrl/Cmd + K` or `/`, then search, arrow keys, and Enter.
- Scroll reveals, counters, subtle tilt, magnetic buttons, and a live IST clock.
- Global motion toggle with a saved preference. System reduced-motion preferences take priority.
- Responsive phone/tablet layouts, visible keyboard focus, native modal focus management, and an email-copy fallback.
- Downloadable résumé, real project links, and a 1200 × 630 social preview image.

The project previews are actual demo screenshots. PathPilot's nine route/ICMP checks and WaveSched's 30 held-out cases are synthetic lab evidence. The browser LLM in WaveSched is pretrained and separate from its fitted scheduling policy. Neither project operates a live network.

## Local preview

Run a local static server from this folder, then open the address it prints:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

## Deployment

This directory includes `vercel.json` for Vercel. Deploy the folder as a static site; no build command is required.

No public deployment has been completed. Before posting a hosted link on LinkedIn, set `og:image` and `twitter:image` in `index.html` to the absolute HTTPS URL of `/assets/og-card.png`, and add the final canonical URL and `og:url`.

## Editing and checks

- `index.html`: résumé content, social links, and section layout.
- `styles.css`: visual design, responsive layouts, and CSS animations.
- `script.js`: filtering, dialogs, command navigation, scroll effects, and motion preferences.
- `network-scene.js`: standalone canvas renderer; pauses offscreen and when the tab is hidden.
- `assets/og-card.svg`: editable social-preview artwork; regenerate the PNG after editing.

Run static checks with `node --test tests/portfolio.test.mjs`, plus syntax checks with `node --check script.js` and `node --check network-scene.js`. Check the site in a browser at narrow phone, tablet, and desktop widths after visual changes.

The résumé download is the current one-page PDF, including both projects, both awards and the updated Oracle experience. Contact buttons open email/phone applications or copy the address; no messages are sent or collected by this site. Fonts are loaded from Google Fonts with local fallbacks.
