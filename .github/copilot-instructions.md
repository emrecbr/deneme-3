# Copilot / AI Agent Instructions for Telepet Backend

Purpose: help an AI coding agent be immediately productive in this Express + Mongoose backend.

- **Entry point & runtime**: this project uses ES modules (`"type": "module"`) and the server entry is [server.js](server.js#L1-L30). Use `npm run dev` (nodemon) for development and `npm start` for production (`package.json`).

- **Architecture (big picture)**:
  - Express app wired in [server.js](server.js#L1-L60). Routes are mounted under `/api`.
  - Route layer: `routes/` (e.g. [authRoutes.js](routes/authRoutes.js#L1-L20), [rfqRoutes.js](routes/rfqRoutes.js#L1-L40), [offerRoutes.js](routes/offerRoutes.js#L1-L40)). Keep routing thin.
  - Controller layer: `controllers/` (example: [authController.js](controllers/authController.js#L1-L120)) implements business logic and uses `next(error)` for centralized error handling.
  - Models: `models/` (Mongoose schemas: `User`, `RFQ`, `Offer`). Relations: RFQ has `buyer` and `offers` (refs to `User` and `Offer`) — see [models/RFQ.js](models/RFQ.js#L1-L60).
  - Middleware: `middleware/` provides `authMiddleware` (JWT cookie auth), `requireRole` role-check helper, and centralized `errorMiddleware` that returns stack only in development (`NODE_ENV`). See [middleware/authMiddleware.js](middleware/authMiddleware.js#L1-L40) and [middleware/errorMiddleware.js](middleware/errorMiddleware.js#L1-L30).
  - DB: MongoDB via Mongoose — connection created in [config/db.js](config/db.js#L1-L20). Env var `MONGODB_URI` required.

- **Auth & session patterns**:
  - JWT tokens are signed in `controllers/authController.js` and sent back as an httpOnly cookie named `token` (7-day expiry). Agents should preserve that cookie when calling protected endpoints. See `TOKEN_COOKIE_NAME` in [authController.js](controllers/authController.js#L1-L40).
  - `authMiddleware` reads `req.cookies.token` and sets `req.user` to the JWT payload (which includes `id` and `role`). Tests or API calls must include cookie support.

- **Common controller conventions** (follow existing style):
  - Async handlers use `try { ... } catch (error) { next(error); }` and throw `Error` instances with `error.statusCode` when specific HTTP codes are needed (see `register` and `login` in [authController.js](controllers/authController.js#L1-L120)).
  - Success responses follow `{ success: true, data: ... }` and errors use the centralized error format from `errorMiddleware`.

- **Model & DB conventions**:
  - `User` hashes password via a `pre('save')` hook and exposes `comparePassword` instance method. Login explicitly uses `.select('+password')` to fetch the hashed password (see [models/User.js](models/User.js#L1-L80) and [authController.js](controllers/authController.js#L30-L60)).
  - RFQ lifecycle: `status` enum `['open','closed','awarded']`. Buyers create RFQs; suppliers create `Offer` entries that reference RFQ and `supplier` (see [routes/offerRoutes.js](routes/offerRoutes.js#L1-L40)).

- **Role & permission patterns**:
  - Roles: `buyer`, `supplier`, `admin` (see [models/User.js](models/User.js#L1-L40)).
  - Role checks are done either via `requireRole(...)` or inline role comparisons (e.g. `if (req.user.role !== 'supplier')` in `offerRoutes`). Prefer existing patterns when adding new endpoints.

- **Error handling & response shape**:
  - Controllers throw errors with `.statusCode` for non-2xx responses. The `errorMiddleware` returns `{ success: false, message, stack? }`. Agents should use the same shape when writing tests or new controllers.

- **Developer workflows / commands**:
  - Start dev server: `npm run dev` (nodemon, port 3001 by default).
  - Start production server: `npm start`.
  - Environment variables required: `MONGODB_URI`, `JWT_SECRET`, optionally `NODE_ENV`.

- **Integration points & external dependencies**:
  - MongoDB via Mongoose (`mongoose`), JWT via `jsonwebtoken`, password hashing `bcryptjs`. See `package.json` for exact versions.
  - Cookies: `cookie-parser` is used; tests or integration scripts must support cookie handling for authenticated flows.

- **Examples to follow when modifying code**:
  - Creating a new protected route: add the route to `routes/`, call controller in `controllers/`, and guard with `authMiddleware` plus role checks where needed. Mirror patterns in `rfqRoutes.js` and `offerRoutes.js`.
  - When adding model relations, use Mongoose `ref` and populate in controllers (see `.populate('buyer', 'name email role')` in [rfqRoutes.js](routes/rfqRoutes.js#L1-L30)).

- **What not to change** (unless explicitly requested):
  - Global response shapes (`{ success: true|false, data?, message? }`) and error middleware behavior.
  - Cookie-based token name and expiry handling.

If any section is unclear or you want me to include more examples (curl snippets, Postman sequences, or line-anchored links), tell me which area to expand and I'll iterate.
