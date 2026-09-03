# PO MVP Implementation Runbook

This runbook is the strict execution checklist for completing the Purchase Order (PO) backlog. Complete each checkpoint before starting the next phase.

## Scope

Included:
- PO list, create, detail, and submit workflows
- Five PO REST endpoints
- Allocation and status validations
- Focused Jest, Vitest, and Playwright coverage

Decisions:
- One PO may contain lines from exactly one approved PR.
- PR line identity, item data, UOM, site, and required date are server-owned.
- Ordered quantity and vendor unit price are user inputs.

Excluded:
- Dashboard PO summaries
- Goods Receipt implementation
- Bookmarks
- PO editing, deletion, cancellation, or approval
- Advanced filtering, reporting, SSO, and production-grade numbering

## Phase 0: Align the Contract

- [ ] Add `GET /api/purchase-orders` to the PO API inventory in `docs/plan.md`.
- [ ] Record that the PO backend routes and core service already exist.
- [ ] Define the create workflow as one approved PR per PO.
- [ ] Define server-owned and client-owned PO line fields.
- [ ] Keep GR and optional extensions out of the PO backlog.

### Checkpoint 0

- [ ] All five PO endpoints are documented:
  - `GET /api/purchase-orders`
  - `POST /api/purchase-orders`
  - `GET /api/purchase-orders/:id`
  - `POST /api/purchase-orders/:id/submit`
  - `GET /api/purchase-orders/:id/open-lines`
- [ ] Scope boundaries and field ownership are explicit.

## Phase 1: Harden the Backend

### Validation

- [ ] Update `validateCreatePayload()` in `backend/src/services/purchase-order-service.js`.
- [ ] Require a non-empty vendor name.
- [ ] Require at least one PO line.
- [ ] Require a `prLineId` for every line.
- [ ] Reject duplicate `prLineId` values.
- [ ] Reject zero, negative, non-numeric, and non-finite quantities.
- [ ] Reject negative, non-numeric, and non-finite unit prices.

### Allocation Integrity

- [ ] Extend the locked PR-line query to load its PR ID and item metadata.
- [ ] Enforce that every selected line belongs to the same PR.
- [ ] Enforce that the source PR has `APPROVED` status.
- [ ] Keep `SELECT ... FOR UPDATE` around remaining-quantity validation.
- [ ] Enforce `qtyOrdered <= qtyRequested - qtyAllocated`.
- [ ] Populate PO item fields from the locked PR line, not request metadata.
- [ ] Populate quantity and unit price from the validated request.

### Transaction Integrity

- [ ] Insert the PO header with `DRAFT` status.
- [ ] Insert PO lines and allocation bridge records atomically.
- [ ] Increment `pr_lines.qty_allocated` atomically.
- [ ] Commit only after every line succeeds.
- [ ] Roll back and release the client on every failure.

### Tests

- [ ] Retain existing validation, over-allocation, status, list, and open-line tests.
- [ ] Add duplicate PR-line rejection coverage.
- [ ] Add mixed-PR rejection coverage.
- [ ] Prove PO metadata comes from the database despite tampered client values.
- [ ] Add non-finite numeric input coverage.
- [ ] Verify exact-remaining allocation succeeds.
- [ ] Verify failures roll back and release the client.
- [ ] Verify only `DRAFT` can transition to `SUBMITTED`.
- [ ] Make the Jest ESM scripts in `backend/package.json` portable on Windows.

### Checkpoint 1

Run from the repository root:

```powershell
npm run test:backend -- --runInBand
```

With PostgreSQL running, verify:

- [ ] The seeded PO appears in the list response.
- [ ] PO detail includes source PR allocations.
- [ ] Valid creation returns `201` and `DRAFT`.
- [ ] Over-allocation returns `422`.
- [ ] Duplicate lines return `422`.
- [ ] Mixed-PR lines return `422`.
- [ ] A non-approved PR returns `422`.
- [ ] Submit changes only `DRAFT` to `SUBMITTED`.
- [ ] Committed allocation increases `pr_lines.qty_allocated` exactly once.

Do not continue until all checks pass.

## Phase 2: Add the Frontend Shell

### API Client

Add these methods to `frontend/src/api.js`:

- [ ] `listPurchaseOrders()`
- [ ] `createPurchaseOrder(payload)`
- [ ] `getPurchaseOrder(id)`
- [ ] `submitPurchaseOrder(id)`

Reuse:

- [ ] `listRequisitions()` for choosing an approved PR.
- [ ] `getRequisitionOpenLines(id)` for loading allocatable lines.

Do not add a frontend PO open-lines method; that endpoint supports the deferred GR flow.

### Routes and Navigation

- [ ] Register `/purchase-orders`.
- [ ] Register `/purchase-orders/new`.
- [ ] Register `/purchase-orders/:id`.
- [ ] Add Purchase Orders to the existing application navigation.
- [ ] Preserve existing route naming, active-link, and styling patterns.

### Checkpoint 2

```powershell
npm run build --prefix frontend
```

- [ ] The build passes.
- [ ] All three PO routes load directly.
- [ ] Refreshing each route works.
- [ ] There are no import or browser console errors.

## Phase 3: Implement PO List and Detail

### PO List

- [ ] Create `frontend/src/pages/POListPage.vue`.
- [ ] Fetch `{ items }` from the list endpoint.
- [ ] Show PO number, vendor, status, and created date.
- [ ] Link every row to PO detail.
- [ ] Add a New PO action.
- [ ] Handle loading, empty, and error states.

Do not add sorting, filtering, or totals not supplied by the API.

### PO Detail

- [ ] Create `frontend/src/pages/PODetailPage.vue`.
- [ ] Show PO number, vendor, and status.
- [ ] Show ordered lines, quantities, prices, and source PR allocations.
- [ ] Show Submit only when status is `DRAFT`.
- [ ] Refresh local detail after a successful submit.
- [ ] Prevent duplicate submit requests.
- [ ] Handle loading and API errors.

### Checkpoint 3

- [ ] The list displays seeded `PO-2026-0001`.
- [ ] Its detail shows `SUBMITTED`, two lines, and linked PR allocations.
- [ ] A DRAFT PO can be submitted once.
- [ ] A submitted PO has no submit action.
- [ ] The frontend build still passes.

## Phase 4: Implement PO Creation

### Source PR

- [ ] Create `frontend/src/pages/POCreatePage.vue`.
- [ ] Load requisitions and offer only `APPROVED` entries.
- [ ] Require exactly one selected PR.
- [ ] Load that PR's open lines.
- [ ] Show only lines where `qtyOpenForPo > 0`.

### Line Selection

- [ ] Allow one or more lines from the selected PR.
- [ ] Display item metadata and available quantity as read-only.
- [ ] Collect a positive ordered quantity.
- [ ] Collect a non-negative unit price.
- [ ] Prevent submission when no line is selected.
- [ ] Show an inline error when quantity exceeds availability.

### Submission

- [ ] Send only the minimal client-owned payload.
- [ ] Disable the form while saving.
- [ ] Display backend `422` errors without losing entered data.
- [ ] Redirect successful creation to PO detail.

### Component Tests

- [ ] Test approved-PR filtering.
- [ ] Test open-line rendering.
- [ ] Test quantity and price validation.
- [ ] Test minimal payload mapping.
- [ ] Test successful redirect.

### Checkpoint 4

```powershell
npm run test:frontend
npm run build --prefix frontend
```

Using the seed data:

- [ ] `PR-2026-0001` exposes remaining quantities 8 and 30.
- [ ] DRAFT and SUBMITTED PRs cannot be selected.
- [ ] A valid subset creates one DRAFT PO.
- [ ] The browser redirects to PO detail.
- [ ] Missing vendor, no lines, zero, negative, and excessive quantities are blocked.
- [ ] A stale-allocation `422` is visible and preserves the form.

## Phase 5: Add E2E Proof

- [ ] Create `tests/e2e/po-flow.spec.js`.
- [ ] Create, submit, and approve a fresh PR through API setup for each scenario.
- [ ] Navigate to PO creation through the browser.
- [ ] Select the approved PR and its open lines.
- [ ] Enter quantity and price.
- [ ] Create the PO and verify its DRAFT detail.
- [ ] Submit the PO and verify `SUBMITTED` status.
- [ ] Add focused over-allocation coverage.
- [ ] Use role- and label-based locators.
- [ ] Do not assert generated PO numbers.
- [ ] Do not consume fixed seed availability.

### Checkpoint 5: Release Gate

Bootstrap a clean database when needed:

```powershell
docker compose down -v
docker compose up -d db
```

Run all automated gates:

```powershell
npm run test:backend -- --runInBand
npm run test:frontend
npm run build --prefix frontend
```

Start the application in a separate terminal:

```powershell
npm run dev
```

Then run E2E twice:

```powershell
npm run test:e2e
npm run test:e2e
```

Final acceptance:

- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Frontend production build passes.
- [ ] E2E passes twice without resetting seed quantities.
- [ ] PO list, create, and detail are usable at desktop and mobile widths.
- [ ] Controls and text do not overlap.
- [ ] API errors are visible and actionable.
- [ ] No GR or post-backlog functionality was introduced.

The PO MVP backlog is complete only when every release-gate item passes.
