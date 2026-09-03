# Graph Report - 2026-github-copilot-workshop  (2026-09-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 78 nodes · 136 edges · 10 communities (6 shown, 2 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `19a616fa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RequisitionDetailPage.vue
- purchase-order-service.js
- requisition-service.js
- app.js
- RequisitionCreatePage.vue
- App.vue
- 00-init-mvp-db.sh
- playwright.config.js

## God Nodes (most connected - your core abstractions)
1. `requisitionRoutes()` - 9 edges
2. `purchaseOrderRoutes()` - 8 edges
3. `getRequisitionById()` - 8 edges
4. `createPurchaseOrder()` - 7 edges
5. `getPurchaseOrderById()` - 7 edges
6. `createRequisition()` - 6 edges
7. `buildApp()` - 6 edges
8. `getOpenPoLines()` - 5 edges
9. `listPurchaseOrders()` - 5 edges
10. `submitPurchaseOrder()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `buildApp()` --indirect_call--> `purchaseOrderRoutes()`  [INFERRED]
  backend/src/app.js → backend/src/routes/purchase-order-routes.js
- `buildApp()` --indirect_call--> `requisitionRoutes()`  [INFERRED]
  backend/src/app.js → backend/src/routes/requisition-routes.js
- `buildApp()` --indirect_call--> `dbPlugin()`  [INFERRED]
  backend/src/app.js → backend/src/plugins/db.js
- `start()` --calls--> `buildApp()`  [EXTRACTED]
  backend/src/server.js → backend/src/app.js
- `purchaseOrderRoutes()` --calls--> `createPurchaseOrder()`  [EXTRACTED]
  backend/src/routes/purchase-order-routes.js → backend/src/services/purchase-order-service.js

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "RequisitionDetailPage.vue"
Cohesion: 0.14
Nodes (9): api, stats, errorMessage, requisition, route, errorMessage, items, router (+1 more)

### Community 1 - "purchase-order-service.js"
Cohesion: 0.25
Nodes (10): purchaseOrderRoutes(), createPoNumber(), createPurchaseOrder(), getOpenPoLines(), getPurchaseOrderById(), listPurchaseOrders(), mapHeader(), mapLine() (+2 more)

### Community 2 - "requisition-service.js"
Cohesion: 0.35
Nodes (11): requisitionRoutes(), approveRequisition(), createPrNumber(), createRequisition(), getRequisitionById(), getRequisitionOpenLines(), listRequisitions(), mapHeader() (+3 more)

### Community 3 - "app.js"
Cohesion: 0.46
Nodes (4): buildApp(), config, dbPlugin(), start()

### Community 4 - "RequisitionCreatePage.vue"
Cohesion: 0.29
Nodes (5): addLine(), emptyLine(), errorMessage, form, router

### Community 5 - "App.vue"
Cohesion: 0.50
Nodes (3): isDashboard, isRequisitions, route

## Knowledge Gaps
- **15 isolated node(s):** `stats`, `errorMessage`, `requisition`, `route`, `errorMessage` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 31 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `purchaseOrderRoutes()` connect `purchase-order-service.js` to `app.js`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `requisitionRoutes()` connect `requisition-service.js` to `app.js`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `buildApp()` connect `app.js` to `purchase-order-service.js`, `requisition-service.js`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `stats`, `errorMessage`, `requisition` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RequisitionDetailPage.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._