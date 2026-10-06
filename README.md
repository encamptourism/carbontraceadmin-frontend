# CarbonTrace Admin — Frontend

Admin console for **CarbonTrace**: register sales, track carbon offset adjustment and UCR retirements, bill clients, manage the Algorand treasury wallet and CTCoin rewards.

Built with **Next.js 16 (Pages Router)** and **React 19**. No UI framework: plain CSS in `src/styles/globals.css`, shared components in `src/lib/ui.js`.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # point API_URL at your backend
npm run dev                  # http://localhost:3000
```

| Script          | What it does                     |
| --------------- | -------------------------------- |
| `npm run dev`   | Dev server with hot reload       |
| `npm run build` | Production build                 |
| `npm start`     | Serve the production build       |
| `npm run lint`  | ESLint (`eslint-config-next`)    |

## Configuration

| Variable  | Default                         | Purpose                                  |
| --------- | ------------------------------- | ---------------------------------------- |
| `API_URL` | `https://admin.carbontrace.in`  | CarbonTrace backend the app proxies to   |

`API_URL` is read on the server at startup by `next.config.mjs`. Restart the dev server after changing it.

## How it talks to the backend

The browser only ever calls this app's own origin. `next.config.mjs` rewrites:

| Browser path            | Backend path        |
| ----------------------- | ------------------- |
| `/api/v1/*`             | `/api/v1/*`         |
| `/auth/login`, `/logout`| `/login`, `/logout` |
| `/backend/wallet/*`     | `/wallet/*`         |

So there's no CORS configuration, and the backend's **httpOnly session cookie** stays first-party. JavaScript never sees a token; `localStorage.authed` is only a UI hint for whether to show the app or `/login`. Any `401` from the API clears it and sends the user back to `/login`.

## Project layout

```
src/
  lib/
    api.js        fetch wrapper, login/logout, public routes
    ui.js         shared components: Card, DataTable, FormDialog, PageHead, Icon, CountUp, …
  pages/
    _app.js       app shell, sidebar, auth gate
    index.js      dashboard
    sales/        sales registers, pending/adjusted/failed-UCR orders, UCR lots
    billing/      invoices, ageing report, invoice detail
    accounts/     clients, client detail, confirmed-transaction audit
    wallet.js, projects.js, rewards.js, inquiries.js,
    notifications.js, tools.js, logs.js, settings.js
    login.js      sign-in
    pay/[token].js, claim.js   public pages (no login): client payment link, reward claim
  styles/globals.css
swagger.json      backend API reference
```

Most API responses aren't described in `swagger.json`, so list and detail views render whatever fields come back (`DataTable`, `KeyValues`, `Tiles` in `src/lib/ui.js`).

## UI notes

- Light and dark themes follow the OS setting; colours are CSS variables at the top of `globals.css`.
- Tables turn into stacked cards below 600px.
- Animations are disabled when the OS has *reduce motion* turned on.

## Sharing a dev build

`next.config.mjs` allows `*.trycloudflare.com` as a dev origin, so you can share the running dev server with:

```bash
cloudflared tunnel --url http://localhost:3000
```

Anyone with the printed URL can reach the login page, so stop the tunnel when you're done.

## Deployment

Any Node host that runs `next build && next start` works (the rewrites need the Next.js server, so a static export won't). Set `API_URL` in the host's environment.
