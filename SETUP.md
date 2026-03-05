# SwordigoPlus Backend — Setup Guide
*No CLI required. Everything done from web dashboards.*

---

## Step 1 — Create the Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and log in.
2. In the left sidebar click **Workers & Pages**.
3. Click **Create** → **Create Worker**.
4. Give it a name like `swordigoplus-backend` and click **Deploy**.
5. You'll see a default "Hello World" worker — that's fine, we'll replace it.

---

## Step 2 — Create the D1 Database

1. In the left sidebar click **D1 SQL**.
2. Click **Create database**.
3. Name it `swordigoplus` and click **Create**.
4. Once created, **copy the Database ID** shown on the database page.

---

## Step 3 — Run the database schema

1. Open your `swordigoplus` database in the D1 dashboard.
2. Click the **Console** tab.
3. Paste the entire contents of [`schema/001_auth.sql`](./schema/001_auth.sql) into the console.
4. Click **Execute**. You should see `3 statements executed successfully`.

---

## Step 4 — Connect D1 to the Worker

1. Go back to your Worker (`swordigoplus-backend`).
2. Click **Settings** → **Bindings**.
3. Click **Add** → **D1 Database**.
4. Set **Variable name** to exactly `DB`.
5. Select your `swordigoplus` database.
6. Click **Save**.

---

## Step 5 — Push your code (via GitHub + Cloudflare Pages/Workers CI)

The easiest no-CLI approach is:

1. **Create a GitHub repo** at [github.com/new](https://github.com/new) (e.g. `swordigoplus-backend`).
2. Upload all files from the `backend/` folder to the repo  
   *(GitHub has a drag-and-drop file uploader — click **Add file** → **Upload files**)*.
3. In the Cloudflare Workers dashboard, go to your Worker → **Settings** → **Build** (or redeploy via **Edit Code**).

> **Alternative (even simpler for now):** Use the **Edit Code** button in the Cloudflare Worker dashboard to paste in each file manually while developing. Once you're ready to go live, connect GitHub.

---

## Step 6 — Set environment variables

1. In your Worker → **Settings** → **Environment Variables**.
2. The values in `wrangler.toml` under `[vars]` are automatically set when deployed via Wrangler CLI. When using the dashboard, add them manually:

| Variable | Value |
|---|---|
| `APP_NAME` | `SwordigoPlus` |
| `CORS_ORIGIN` | `*` (change to your frontend URL in production) |
| `ACCESS_TOKEN_TTL` | `900` |
| `REFRESH_TOKEN_TTL` | `2592000` |
| `RATE_LIMIT_LOGIN_MAX` | `5` |
| `RATE_LIMIT_LOGIN_WINDOW` | `900` |
| `RATE_LIMIT_REGISTER_MAX` | `3` |
| `RATE_LIMIT_REGISTER_WINDOW` | `3600` |
| `PBKDF2_ITERATIONS` | `100000` |

---

## Step 7 — Test your endpoints

Use [Hoppscotch](https://hoppscotch.io) (free, browser-based REST client) or any REST client.

Your Worker URL will be: `https://swordigoplus-backend.<your-subdomain>.workers.dev`

### ✅ Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "username": "testuser",
  "password": "Test1234",
  "display_name": "Test User"
}
```
**Expected:** `201` with `access_token` in body + `refresh_token` HttpOnly cookie.

### ✅ Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test1234"
}
```
**Expected:** `200` with `access_token` + user info.

### ✅ Get current user
```
GET /auth/me
Authorization: Bearer <access_token>
```
**Expected:** `200` with public user profile.

### ✅ Refresh token
```
POST /auth/refresh
(Cookie: refresh_token=<value>  OR body: { "refresh_token": "<value>" })
```
**Expected:** `200` with new `access_token`.

### ✅ Logout
```
POST /auth/logout
Authorization: Bearer <access_token>
```
**Expected:** `200` + refresh cookie cleared.

### ✅ Rate limit test
Send 6 login requests quickly with wrong credentials.
**Expected:** 6th request returns `429 RATE_LIMITED`.

### ✅ Health check
```
GET /health
```
**Expected:** `200 { ok: true, service: "SwordigoPlus" }`

---

## Notes

- **Refresh token** is stored in an `HttpOnly; Secure; SameSite=Strict` cookie and is only valid on `POST /auth/refresh`. It never appears in the response body (except on the fallback body path for native clients).
- **Access token** is short-lived (15 min). Your frontend should call `/auth/refresh` automatically when it gets a `401 TOKEN_EXPIRED`.
- **Tokens are never stored raw** — only their SHA-256 hashes are in D1. A DB leak reveals nothing.
- **CORS** is set to `*` by default. Before going public, change `CORS_ORIGIN` to your actual frontend domain e.g. `https://swordigoplus.com`.
