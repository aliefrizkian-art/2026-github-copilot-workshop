# Project Progress

Last reviewed: September 2, 2026

## Current Summary

The repository contains a working procurement baseline for Purchase Requisitions (PR) and a backend implementation for Purchase Orders (PO). The PO user interface remains the primary backlog.

| Area | State | Summary |
| --- | --- | --- |
| Infrastructure | Implemented | Fastify, PostgreSQL in Docker, Vue 3/Vite, Jest, Vitest, and Playwright configuration |
| Database | Implemented | PR, PO, allocation, and GR schema plus sample seed data |
| PR backend | Implemented | List, create, detail, submit, approve, and open-line APIs |
| PR frontend | Implemented | Dashboard, list, create, and detail pages |
| PO backend | Implemented | List, create, detail, submit, and open-line APIs with hardened allocation checks |
| PO frontend | Implemented | PO list, Figma-derived create, detail, navigation, and status flow are connected |
| GR | Schema only | Tables exist; routes, services, pages, and tests are intentionally deferred |
| API documentation | Implemented | Swagger UI is available at `/api-docs` |
| Automated tests | Partial | Backend service and PR frontend page tests exist; no PO frontend or E2E tests |

## Infrastructure

Implemented:

- Fastify 5 backend using JavaScript ES modules.
- PostgreSQL 16 database through Docker Compose.
- Database pool registration and graceful shutdown through the Fastify DB plugin.
- Vue 3 frontend built with Vite and Vue Router.
- CORS support through `@fastify/cors`.
- OpenAPI generation through `@fastify/swagger`.
- Swagger UI through `@fastify/swagger-ui` at `http://localhost:3000/api-docs`.
- OpenAPI JSON at `http://localhost:3000/api-docs/json`.
- Jest for backend service tests.
- Vitest, Vue Test Utils, and happy-dom for frontend tests.
- Playwright configured for Chromium and `http://localhost:5173`.
- Root development script that starts the backend and frontend concurrently.

The database bootstrap is provided by:

- `db/migrations/001_init_procurement_mvp.sql`
- `db/seeds/002_seed_procurement_mvp.sql`
- `docker/postgres/init/00-init-mvp-db.sh`

## Database State

The schema includes:

- `purchase_requisitions`
- `pr_lines`
- `purchase_orders`
- `po_lines`
- `pr_line_allocations`
- `goods_receipts`
- `gr_lines`

The seed creates sample PRs in APPROVED, SUBMITTED, and DRAFT states. It also creates a submitted PO with allocations from the approved PR, providing baseline data for PO API and future UI work.

Quantity tracking is denormalized in `pr_lines.qty_allocated`, `pr_lines.qty_received`, and `po_lines.qty_received`. Allocation traceability is stored in `pr_line_allocations`.

## Purchase Requisition Module

### Backend

The PR backend is implemented with six endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/requisitions` | List PR headers, newest first |
| `POST` | `/api/requisitions` | Create a DRAFT PR with lines |
| `GET` | `/api/requisitions/:id` | Get a PR and its lines |
| `POST` | `/api/requisitions/:id/submit` | Move a PR from DRAFT to SUBMITTED |
| `POST` | `/api/requisitions/:id/approve` | Move a PR from SUBMITTED to APPROVED |
| `GET` | `/api/requisitions/:id/open-lines` | Return lines with remaining quantity for PO allocation |

Creation is transactional and validates required header fields, line fields, positive requested quantities, and non-negative estimated prices.

### Frontend

Implemented pages:

- Dashboard with PR counts and recent PRs.
- PR list.
- PR create form with dynamic lines.
- PR detail with status-dependent submit and approve actions.

The frontend API client supports all six PR endpoints. Vue Router contains dashboard and PR list/create/detail routes.

## Purchase Order Module

### Backend Status

The PO route and service layers are implemented and registered in the Fastify application. Creation uses a database transaction and locks referenced PR lines with `SELECT ... FOR UPDATE` before checking allocation availability.

Implemented business behavior:

- A PO is created with DRAFT status.
- Source PR lines must exist.
- Source PRs must be APPROVED.
- Duplicate PR line references are rejected.
- Every PO line must belong to the same PR.
- Ordered quantity cannot exceed the PR line's remaining quantity.
- Non-finite quantities and unit prices are rejected.
- PO item metadata is copied from the locked PR rows rather than trusted from the request.
- PO lines and `pr_line_allocations` records are inserted atomically.
- `pr_lines.qty_allocated` is incremented in the same transaction.
- Failed creation rolls back and releases the database client.
- Only a DRAFT PO can move to SUBMITTED.
- PO detail includes source PR allocation information.
- Open PO lines are calculated as `qtyOrdered - qtyReceived`.

### Available PO API Endpoints

#### `GET /api/purchase-orders`

Lists PO headers ordered by creation time descending.

Success response: `200 OK`

```json
{
  "items": [
    {
      "id": "uuid",
      "poNumber": "PO-2026-0001",
      "status": "DRAFT",
      "vendorName": "PT Supplier",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

An empty database returns `{ "items": [] }`.

#### `POST /api/purchase-orders`

Creates a DRAFT PO and allocates approved PR quantities.

Current request shape:

```json
{
  "vendorName": "PT Supplier",
  "lines": [
    {
      "prLineId": "uuid",
      "qtyOrdered": 5,
      "unitPrice": 150000
    }
  ]
}
```

Responses:

- `201 Created` with full PO detail.
- `422 Unprocessable Entity` for invalid payloads, missing PR lines, non-approved PRs, or over-allocation.
- `500 Internal Server Error` for unhandled failures.

Item code, item name, UOM, site, and required date are sourced from the locked PR line. Duplicate PR lines and lines from different PRs return `422 Unprocessable Entity` with a clear rule message.

#### `GET /api/purchase-orders/:id`

Returns a PO header, its lines, calculated open quantities, and allocation sources.

Success response: `200 OK`

Each line includes:

- `lineNo`
- `itemCode` and `itemName`
- `qtyOrdered`, `qtyReceived`, and `qtyOpenForGr`
- `uom`, `unitPrice`, `siteCode`, and `requiredDate`
- `allocations` with `prLineId`, `prNumber`, and `allocatedQty`

A missing PO returns `404 Not Found` with `{ "message": "Purchase order not found" }`.

#### `POST /api/purchase-orders/:id/submit`

Moves a PO from DRAFT to SUBMITTED and returns the updated PO detail.

Responses:

- `200 OK` on a valid transition.
- `404 Not Found` when the PO does not exist.
- `422 Unprocessable Entity` with `Only DRAFT purchase order can be submitted` for an invalid transition.

#### `GET /api/purchase-orders/:id/open-lines`

Returns lines where `qtyOrdered - qtyReceived > 0`. This endpoint is available for the deferred GR workflow.

Success response: `200 OK`

```json
{
  "purchaseOrder": {
    "id": "uuid",
    "poNumber": "PO-2026-0001",
    "status": "SUBMITTED"
  },
  "openLines": []
}
```

A missing PO returns `404 Not Found`.

### Frontend Status

Implemented:

- PO list page with empty and error states.
- Figma-derived `PurchaseOrderCreatePage.vue`.
- PO detail page with allocation traceability and DRAFT submission.
- Reusable PO header and line allocation components.
- Approved PR loading and open-line refresh.
- Client-side over-allocation validation against `qtyOpenForPo`.
- Save As Draft through PO creation and Submit PO through create-then-submit.
- PO API client methods for list, create, detail, submit, and open lines.
- PO list, create, and detail routes.
- Purchase Orders navigation link.

The current PO Create route is `/purchase-orders/new`.

The backend PO APIs are therefore usable directly, but the current browser application exposes only the PR workflow.

## Goods Receipt Module

The database schema contains GR header and line tables. No GR route, service, frontend page, or automated test is implemented. This matches the workshop scope, where GR remains a follow-up exercise.

## Automated Test State

Verified test state:

- Backend: 31 Jest tests passing across two service test files.
- Frontend: 17 Vitest tests passing across five page test files.
- Frontend production build passes.

Backend coverage currently includes:

- Empty and populated PR/PO lists.
- PR and PO row-to-response mapping.
- PR and PO open-line filtering.
- PO payload validation.
- PO over-allocation and PR-status guards.
- PO transaction success and rollback behavior.
- PO submit status transitions.

Frontend coverage currently includes:

- PR list rendering.
- PR list error rendering.
- PR create form constraints.
- Adding and removing PR lines.
- PR creation payload and redirect.
- PR creation API error rendering.
- Approved PR filtering and open-line rendering for PO creation.
- Client-side PO over-allocation prevention.
- Backend `422` message rendering.
- PO create-then-submit API sequencing.
- PO list rendering, empty state, and API errors.
- PO detail rendering, allocation source display, and DRAFT submission.

Not yet covered:

- Dashboard and PR detail pages.
- Route-level backend integration tests.
- API client tests.

Playwright coverage is implemented in `tests/e2e/po-module.spec.js`:

- Happy path: create an approved PR fixture, create and submit a PO, and verify detail allocations.
- Negative path: block over-allocation in the UI and verify the backend returns `422` with a clear message.
- Tests use fresh API-created PR fixtures and pass repeatedly without resetting seed quantities.
- HTML report: `playwright-report/index.html`.
- Screenshots, traces, videos, and JSON results: `test-results/`.

## Known Gaps and Risks

### PO backlog

- PO MVP backlog is complete.

### Backend production hardening still deferred

- Replace count-based PR/PO numbering before production use; concurrent creates can generate duplicate numbers.

### Documentation limitation

Swagger/OpenAPI is available and discovers registered routes, but the route definitions do not yet provide detailed request/response JSON schemas. The interactive documentation therefore has limited contract detail.

## Next Recommended Milestone

Continue the deferred Goods Receipt exploration when PO acceptance is complete.

The project is ready for this next milestone without database or framework changes.
