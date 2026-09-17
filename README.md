# Loan Repayment Service

Generates a loan repayment schedule, records payments against it, and reports the position of the
loan at any time.

Next.js 16 (App Router) · React 19 · PostgreSQL (Supabase) · Firebase Authentication · TypeScript.

---

## Setup

Requires **Node.js 22.12 or newer** (developed on 24) and a PostgreSQL 13+ database.

The floor is 22.12 rather than Next.js's own 20.9, and `engines.node` in `package.json` says so:
`firebase-admin@14` requires Node ≥22, and it reaches `jose@6` — which is pure ESM — through
`jwks-rsa` via `require()`. `require()` of an ES module is only unflagged from Node 22.12, so an
older runtime throws `ERR_REQUIRE_ESM` the first time a request is authenticated. Next.js keeps
`firebase-admin` external rather than bundling it (it is on Next's default
`serverExternalPackages` list), so the native `require` is what runs.

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run db:setup               # creates the schema
npm run db:seed                # optional: three demo loans
npm run dev                    # http://localhost:3000
```

`npm run db:setup` applies every migration in `src/db/migrations/` and records it in a
`schema_migrations` table. It is idempotent — safe to re-run, and safe to run on every deploy. No
part of the schema is ever created by hand.

`.env.example` lists every variable with the exact console path it comes from. Real values and a
test account are in the submission email. Nothing secret is committed; `.gitignore` excludes
`.env*` and re-includes only `.env.example`.

Sign in with the test account (email/password or Google), and the dashboard shows the seeded loans.
With an empty database, use **New loan** on the page.

### Database

**Supabase PostgreSQL**, via the transaction pooler connection string. Data access is plain SQL
through `pg` — no ORM. Any PostgreSQL 13+ instance works; the schema uses only core features
(`gen_random_uuid()`, `unnest`, standard constraints). For a local PostgreSQL without TLS, set
`DATABASE_SSL=disable`.

### Tests

```bash
npm test
```

One command, 14 tests. Each one targets a behaviour the brief names:

| Brief requirement | Test |
| --- | --- |
| Reference EMI (₹2,00,000 @ 18% / 24m ≈ ₹9,986) | `unit/schedule` — matches the reference EMI |
| Final instalment carries the remainder | `unit/schedule` — repays the principal to the exact paise |
| Monthly due dates | `unit/schedule` — clamping to the end of short months |
| Zero-month tenure, out-of-range terms | `unit/schedule` — interest-free loan and impossible terms |
| **Underpayment** (₹5,000 of ₹9,984.82) + split across transactions | `unit/allocation` — interest first, leaving the instalment part paid |
| **Overpayment** (2× the instalment) | `unit/allocation` — cascades onto the following instalments |
| **Late payment** (11 days after the due date) | `unit/allocation` — records lateness without moving a due date |
| Excess beyond the whole schedule | `unit/allocation` — holds money no instalment can absorb |
| Overdue amount, next due, days past due | `unit/position` — reports arrears and clears them |
| Loan closure | `unit/position` — closes once every instalment is settled |
| **Integration: success path** | `integration/routes` — creates, allocates, reports the new position |
| **Duplicate submission** | `integration/routes` — does not apply the same payment twice |
| **Invalid input / unknown identifier** | `integration/routes` — negative amount, zero tenure, non-numeric, 404, 400 |
| **Unauthenticated request rejected** | `integration/routes` — 401 on every endpoint |

That is two more than the brief's "approximately eight to twelve", because duplicate
submission and excess credit are guarantees worth asserting on their own rather than
folding into another test. Unit tests (schedule generation, allocation, position) need nothing. The
four integration tests run the real route handlers against a **real database** — no mocks in the
data path — and are skipped with a warning if `DATABASE_URL` is unset. Set `TEST_DATABASE_URL` to
point them at a separate database; they create loans and delete them afterwards.

The only thing mocked in the integration suite is Firebase's token *verification*, since checking an
RS256 signature against Google's keys is Firebase's behaviour rather than this service's, and
exercising it would tie the suite to a live network and a real password. What is this service's
behaviour — that every endpoint refuses a request without a valid bearer token — runs against the
real `authenticateRequest`.

---

## Authentication

Firebase Authentication with email/password or Google.

All three route handlers are wrapped in `withAuth` (`src/api/handler.ts`), which verifies the
`Authorization: Bearer <firebase-id-token>` header with the **Firebase Admin SDK** before the
handler body runs. Verification is server-side: the client SDK's opinion about who is signed in is
never trusted. Because authentication lives in the wrapper rather than in each handler, an endpoint
cannot forget to check.

The UI sends an unauthenticated visitor to a sign-in screen and offers a sign-out action in the
header — but that gate is a convenience, not the boundary. Roles, per-user ownership, password reset
and email verification are out of scope; loans are not owned by individual users.

---

## API

All endpoints require authentication. Every response uses one envelope:

```jsonc
// success
{ "data": { ... }, "requestId": "6f1c…" }
// failure
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "issues": [ { "field": "tenureMonths", "message": "…" } ] }, "requestId": "6f1c…" }
```

Codes: `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `NOT_FOUND` 404 · `CONFLICT` 409 ·
`INTERNAL_ERROR` 500 · `SERVICE_UNAVAILABLE` 503.

Every monetary field is serialised as `{ "paise": 998482, "rupees": "9984.82" }`. `paise` is the
canonical exact integer; `rupees` is a string so a display value never passes through a JSON float.

### `POST /api/loans` — create a loan

```jsonc
{ "principal": 200000, "annualInterestRate": 18, "tenureMonths": 24, "disbursementDate": "2025-01-15" }
```

`201` with `{ loan, schedule, position }`. Generates and persists the full schedule in one
transaction. Amounts are supplied in **rupees**; the API converts to paise at the boundary.

Limits, per the brief: principal ₹50,000–₹10,00,000, tenure 3–36 months, rate 0–100% p.a.

### `GET /api/loans/:loanId` — get a loan

`200` with `{ loan, schedule, position, payments }`.

Per instalment: `dueDate`, `principalComponent`, `interestComponent`, `totalDue`, `amountPaid`,
`amountRemaining`, `status`, `daysPastDue`.

Position: `outstandingPrincipal`, `outstandingInterest`, `nextDueDate`, `nextDueAmount`,
`overdueAmount`, `overdueInstallmentCount`, `daysPastDue`, `totalPaid`, `excessCredit`, `status`.

`?asOf=YYYY-MM-DD` asks for the position on a given date; it defaults to today in IST.

### `POST /api/payments` — record a payment

```jsonc
{ "loanId": "…", "amount": 5000, "paymentDate": "2025-02-15", "idempotencyKey": "<uuid>" }
```

`201` with `{ duplicate: false, payment, allocations, loan, schedule, position, payments }`.
A replayed `idempotencyKey` returns `200` with `duplicate: true` and the original allocation.

The response carries the refreshed schedule and position, so the UI updates from this one response
without re-fetching or reloading.

`GET /api/loans` also exists, returning every loan with its headline position for the loan picker.

---

## Money

**Integer paise**, everywhere. Database columns are `BIGINT`; there is no `NUMERIC`, `REAL` or
`DOUBLE PRECISION` column in the schema. In TypeScript the representation is a branded `Paise`
integer, validated at every boundary by `assertPaise`.

An integer `number` rather than `bigint`: the largest loan accepted is ₹10,00,000 = 10⁸ paise, and
even the total payable of the largest, longest, dearest loan stays below 10¹⁰ — six orders of
magnitude inside `Number.MAX_SAFE_INTEGER`, so the arithmetic is exact. `pg` returns `BIGINT` as a
string, which is validated and widened in one place (`paiseFromDb`).

Interest rates are stored as **integer basis points** (18% → 1800) for the same reason: 18.75% has
no exact float representation, 1875 does. The `DATE` and `NUMERIC` type parsers are overridden in
`src/db/client.ts` — `pg` would otherwise turn a due date into a local-midnight `Date` (shifting it
a day west of UTC) and a `NUMERIC` into a float.

### Rounding

The EMI formula needs a real power term, so it is evaluated as a float **once** and rounded to the
nearest paise. Everything derived from it is integer arithmetic.

```
EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)        r = annual% ÷ 12 ÷ 100
```

Each month's interest is charged on the balance outstanding at the start of that month and rounded
half-up to the paise; the rest of the EMI reduces principal. **The final instalment absorbs the
accumulated rounding residue** — it repays the entire remaining balance — so the principal
components sum to exactly the principal disbursed. `generateSchedule` asserts that invariant.

For the brief's reference loan (₹2,00,000 at 18% p.a. over 24 months), the formula gives
**₹9,984.82**. The brief quotes ≈₹9,986 with one to two rupees of tolerance; the exact value is
₹1.18 inside it. A test asserts both the tolerance and the exact figure.

Due dates are the disbursement date plus *n* months, **clamped to the end of short months**: a loan
disbursed on 31 January falls due on 28 February, then 31 March. The due day stays put rather than
drifting into the following month.

---

## Allocation

Implemented in `src/domain/allocation.ts` as a pure function; the service layer only persists what it
returns.

1. **Oldest instalment first**, strictly by due date. Arrears clear before anything current or
   future — the borrower's oldest unpaid bill is the one that closes first.
2. **Interest before principal**, within each instalment. Interest for the period has already been
   earned; principal is the balance still held. This is the standard lending convention, and it
   means a partial payment never looks like it has reduced the balance when it has not.
3. **Cascade.** Whatever is left after an instalment is settled moves to the next one.

### The cases from the brief

**Underpayment** — ₹5,000 against a ₹9,984.82 instalment settles the ₹3,000 of interest in full,
puts ₹2,000 against principal, and leaves the instalment `PARTIALLY_PAID` (or `OVERDUE`) with the
shortfall still counting towards `overdueAmount`. Short payments are never rejected: money received
is money received.

**Overpayment** — extra money **settles the following instalments in advance**; it does not reduce
principal and re-amortise. Two reasons: prepayment closure is explicitly out of scope, and
re-amortising would silently rewrite due dates and interest components the borrower has already been
quoted. Twice the instalment therefore closes instalments 1 and 2, and the next due date moves
forward a month.

**Excess beyond the whole schedule** — if every instalment is settled and money remains, it is
neither forced onto the loan nor discarded. It is stored on the payment row as `unallocated_paise`
and reported as the loan's `excessCredit` for an operator to refund or transfer. A `CHECK`
constraint enforces `allocated + unallocated = amount`, so no paisa can go missing.

**Late payment** — due dates are fixed at disbursement and lateness never moves them. Until money
arrives, the instalment sits in `overdueAmount` with a rising `daysPastDue`. A payment eleven days
late clears those arrears and records `days_late = 11` on the allocation row, which keeps lateness
auditable. Penalty interest is out of scope, so the borrower pays nothing extra — the loan's
*position* changes, its *terms* do not.

**Duplicate submission** — every payment carries a client-supplied `idempotencyKey`. A retry reuses
the key and gets the original payment and allocation back, with no balance touched. This is enforced
in two layers: a cheap pre-check for the ordinary case, and a `UNIQUE` constraint on
`payments.idempotency_key` for the case where two retries race. Application code alone cannot make
that guarantee. Reusing a key with a *different* amount or date is a client bug, not a retry, and
returns `409`.

**Invalid input** — validated with Zod at the boundary and never coerced, so `"5000"`, `null` and
`NaN` are all rejected rather than quietly becoming numbers. Negative amounts, zero-month tenure and
non-numeric values give `400` with per-field `issues`. A malformed loan id gives `400`; a well-formed
one that does not exist gives `404`.

### Concurrency

Recording a payment runs in one transaction that begins by taking a row lock on the loan
(`SELECT … FOR UPDATE`). Two payments arriving at the same moment would otherwise each read the same
instalment balances and each allocate against them, double-crediting the borrower. Different loans
stay fully concurrent. The `installments_not_overpaid` constraint is the backstop.

---

## Layout

```
src/
  app/                  route handlers (api/loans, api/loans/[loanId], api/payments) + the page
  api/                  request validation, response envelope, auth wrapper, serializers
  auth/                 Firebase admin verification, browser SDK, React auth context
  components/           UI — schedule table, position summary, payment form, theme
  config/               server and client environment access
  db/                   pool, migrations + runner, row mappers, repositories
  domain/               money-critical logic: schedule, allocation, position  (pure, no I/O)
  lib/                  money, dates, errors, formatting, browser API client
scripts/                db-setup, seed
tests/                  unit/ and integration/
```

`src/domain` has no I/O and no framework imports, which is what makes the arithmetic
straightforward to test.

---

## Deploying to Vercel

Deployment is out of scope per the brief, but the repository is ready for it.

1. Import the repository in Vercel. `vercel.json` sets the framework, pins the functions to
   `bom1` (Mumbai, next to a Supabase ap-south/ap-northeast instance) and caps route handlers at
   15s, matching the pool's `statement_timeout`.
2. Add every variable from `.env.example` under **Settings → Environment Variables**. Paste
   `FIREBASE_PRIVATE_KEY` on one line keeping the literal `\n` sequences.
3. Use the Supabase **transaction pooler** connection string (port 6543), not the direct one —
   serverless functions open far more connections than a direct Postgres endpoint will accept.
4. Add the deployed domain under **Firebase console → Authentication → Settings → Authorized
   domains**, or Google sign-in will fail there.
5. Confirm **Settings → Node.js Version** is **22.x or newer**. `engines.node` in `package.json`
   already asks for this; if the platform is pinned to an older runtime, every authenticated
   request fails with `ERR_REQUIRE_ESM` from `firebase-admin` (see the Node requirement above).

`npm run vercel-build` runs the migrations and then builds, so a deploy brings the schema up to
date on its own. It is safe on every deploy: migrations are idempotent and serialised by an
advisory lock. A build without database secrets (a preview from a fork) skips migrations with a
warning rather than failing.

## Verification

The four steps in the brief were run against a pristine copy of this repository — a fresh directory
containing only committed files, no `node_modules`, no `.next`:

1. `npm install`, environment applied, `npm run db:setup` → schema created
2. `npm run dev` → ready in 2.6s, page `200`, `GET /api/loans` without a token `401`
3. `npm test` → 14 passed
4. Signed in, listed loans, read a schedule, recorded a payment → allocation applied and the
   position updated

## Notes and trade-offs

- **The pool** is sized for serverless and cached on `globalThis` so dev-server hot reloads do not
  leak connections.
- **The final instalment differs by a rupee or so** from the others by design — it carries the
  rounding residue.
- **`asOf`** is a parameter rather than a hard-coded `now()`, which makes the overdue logic testable
  and lets an operator ask what the position looked like on a given date.
- **Not implemented, per the brief's exclusions:** roles, per-user data, multiple currencies,
  prepayment closure, penalty interest, deployment.
