# Fianza docs (Mintlify)

_Formerly "TrustLine" — renamed to Fianza to avoid confusion with an
unrelated, already-funded SCF project of the same name._

The Fianza documentation site, built with [Mintlify](https://mintlify.com).
Content lives in `*.mdx` files; navigation, theme, and the built-in **Ask AI**
assistant are configured in [`docs.json`](./docs.json).

Mintlify is a *separately hosted* docs service — it does **not** run inside the
Next.js app on Vercel. The app stays where it is; these docs get their own site
(target: `docs.fianza.space`).

---

## 1. Preview locally

```bash
npm i -g mint          # one-time: install the Mintlify CLI
cd mintlify-docs
mint dev                # serves at http://localhost:3000
```

`mint dev` hot-reloads on every save. Use it to click through the sidebar,
confirm the mermaid diagrams and `<Card>` groups render, and check that no
internal link 404s.

If the CLI is out of date: `mint update`. To validate links: `mint broken-links`.

---

## 2. Deploy (Mintlify hosting)

1. Push this repo to GitHub (it already is: `TechnicallyKiller/TrustLine`).
2. Go to [dashboard.mintlify.com](https://dashboard.mintlify.com) → sign in with
   GitHub → **connect the repo**.
3. Set the **docs directory** to `mintlify-docs` (so Mintlify reads `docs.json`
   from here, not the repo root).
4. Mintlify auto-deploys on every push to the default branch. Your site goes
   live at a free `*.mintlify.app` URL immediately.

**Ask AI** is included and needs no code or API key — it indexes these `.mdx`
pages automatically once deployed. It appears as a search/chat control in the
top bar. Ask it something grounded in the docs (e.g. *"How does Fianza size a
credit line?"*) to confirm.

---

## 3. Custom domain — `docs.fianza.space`

**Already done.** For reference, here's how it was set up — you own
`fianza.space` (registrar: **Hostinger**):

1. In the Mintlify dashboard → **Settings → Custom Domain** → enter
   `docs.fianza.space`. Mintlify shows you a **CNAME target** plus two
   verification **TXT records** (`_acme-challenge.docs`,
   `_cf-custom-hostname.docs`).
2. In Hostinger → **hPanel → Domains → fianza.space → DNS / Nameservers →
   DNS Records**, add all three records Mintlify gave you (the CNAME on
   `docs`, and both TXT records).
3. Wait for DNS propagation (minutes to ~1 hour). Mintlify issues SSL
   automatically once the TXT records verify. Docs are live at
   `https://docs.fianza.space`.

### App domain (Vercel), for reference

The main app is on the apex domain in the Vercel dashboard
(**Settings → Domains → `fianza.space`**), with these Hostinger records:

| Type  | Name / Host | Value                   | TTL  |
|-------|-------------|-------------------------|------|
| A     | `@`         | `76.76.21.21`           | 3600 |
| CNAME | `www`       | `cname.vercel-dns.com`  | 3600 |

Delete any parking/`A @` records Hostinger pre-added, or they'll conflict.
`0xtrustline.vercel.app` keeps working alongside the custom domain.

---

## Structure

```
docs.json              theme, nav, colors, Ask-AI config
index.mdx              landing page (Cards + Steps)
what-and-why.mdx       thesis
architecture.mdx       system diagram + the three moving systems
credit-engine.mdx      the full underwriting pipeline (ground truth)
scoring-methodology.mdx short pointer into credit-engine
sybil-model.mdx        the independence moat + threat model
onboarding-kit.mdx     external builder quickstart
sdk-reference.mdx       JS/TS SDK API
sdk-reference-python.mdx Python SDK API
contracts.mdx          deployed testnet contract IDs
roadmap.mdx            shipped / in progress / gap analysis
logo/                  light.svg + dark.svg wordmarks
favicon.svg            tab icon
```

Editing content is just editing the `.mdx` files. Adding a page means creating
the `.mdx` and adding its slug to the relevant group in `docs.json`.
