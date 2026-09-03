import { jest, describe, test, expect } from '@jest/globals';
import {
  createPurchaseOrder,
  listPurchaseOrders,
  getOpenPoLines,
  submitPurchaseOrder,
} from '../../src/services/purchase-order-service.js';

// ── Helpers ──────────────────────────────────────────────

/**
 * Build a valid PO creation payload.
 * Override any field by passing partial objects.
 */
function validPayload(overrides = {}) {
  return {
    vendorName: 'PT Supplier Jaya',
    lines: [
      {
        prLineId: 'pr-line-001',
        qtyOrdered: 5,
        unitPrice: 150000,
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock DB client returned by pool.connect().
 * `queryResponses` is a function(sql, params) => { rows, rowCount }.
 */
function mockClient(queryResponses) {
  return {
    query: jest.fn((sql, params) => queryResponses(sql, params)),
    release: jest.fn(),
  };
}

/**
 * Create a mock db object with pool.connect() and db.query().
 */
function mockDb(client, queryFn) {
  return {
    pool: { connect: jest.fn(() => Promise.resolve(client)) },
    query: jest.fn(queryFn || (() => ({ rows: [], rowCount: 0 }))),
  };
}

/**
 * Standard client responses for a successful PO creation:
 *   BEGIN → PR line SELECT FOR UPDATE → PO count → INSERT header →
 *   INSERT line → INSERT allocation → UPDATE pr_lines → COMMIT
 * Then getPurchaseOrderById calls db.query for header + lines + allocations.
 */
function happyPathClientResponses() {
  return (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    // PR line lock check
    if (sql.includes('FOR UPDATE')) {
      return {
        rows: [{
          id: 'pr-line-001', pr_id: 'pr-001', item_code: 'BRG-001',
          item_name: 'Safety Helmet', uom: 'PCS', site_code: 'WH-JKT',
          required_date: null, qty_requested: 10, qty_allocated: 0,
          pr_status: 'APPROVED',
        }],
        rowCount: 1,
      };
    }
    // PO count
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ total: 3 }], rowCount: 1 };
    }
    // INSERT / UPDATE
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
}

/**
 * db.query responses used by getPurchaseOrderById after creation.
 */
function detailQueryResponses() {
  return (sql) => {
    if (sql.includes('FROM purchase_orders WHERE id')) {
      return {
        rows: [{
          id: 'po-id', po_number: 'PO-2026-0004', status: 'DRAFT',
          vendor_name: 'PT Supplier Jaya', created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM po_lines')) {
      return {
        rows: [{
          id: 'po-line-1', line_no: 1, item_code: 'BRG-001', item_name: 'Safety Helmet',
          qty_ordered: 5, qty_received: 0, uom: 'PCS', unit_price: 150000,
          site_code: 'WH-JKT', required_date: null,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes('pr_line_allocations')) {
      return {
        rows: [{ pr_line_id: 'pr-line-001', pr_number: 'PR-2026-0001', allocated_qty: 5 }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
}

// ─────────────────────────────────────────────────────────
// Payload Validation (via createPurchaseOrder)
// ─────────────────────────────────────────────────────────

describe('createPurchaseOrder – payload validation', () => {
  test('rejects when body is null', async () => {
    const db = mockDb(null);
    await expect(createPurchaseOrder(db, null))
      .rejects.toMatchObject({ message: 'Body is required', statusCode: 422 });
  });

  test('rejects when vendorName is missing', async () => {
    const db = mockDb(null);
    await expect(createPurchaseOrder(db, { lines: [{}] }))
      .rejects.toMatchObject({ message: 'vendorName is required', statusCode: 422 });
  });

  test('rejects when vendorName is empty string', async () => {
    const db = mockDb(null);
    await expect(createPurchaseOrder(db, { vendorName: '   ', lines: [{}] }))
      .rejects.toMatchObject({ message: 'vendorName is required', statusCode: 422 });
  });

  test('rejects when lines is empty array', async () => {
    const db = mockDb(null);
    await expect(createPurchaseOrder(db, { vendorName: 'X', lines: [] }))
      .rejects.toMatchObject({ message: 'lines must contain at least one item', statusCode: 422 });
  });

  test('rejects when lines is not an array', async () => {
    const db = mockDb(null);
    await expect(createPurchaseOrder(db, { vendorName: 'X', lines: 'nope' }))
      .rejects.toMatchObject({ message: 'lines must contain at least one item', statusCode: 422 });
  });

  test('rejects when prLineId is missing', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [{ itemCode: 'A', itemName: 'A', qtyOrdered: 1, unitPrice: 0, uom: 'PCS', siteCode: 'WH' }],
    });
    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({ message: 'lines[0].prLineId is required', statusCode: 422 });
  });

  test('rejects duplicate PR lines', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [validPayload().lines[0], validPayload().lines[0]],
    });
    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({
        message: 'lines[1].prLineId duplicates an earlier line',
        statusCode: 422,
      });
  });

  test('rejects when qtyOrdered is zero', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [{
        prLineId: 'pr-1', itemCode: 'A', itemName: 'A', uom: 'PCS',
        siteCode: 'WH', qtyOrdered: 0, unitPrice: 100,
      }],
    });
    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({ message: 'lines[0].qtyOrdered must be greater than 0', statusCode: 422 });
  });

  test('rejects when unitPrice is negative', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [{
        prLineId: 'pr-1', itemCode: 'A', itemName: 'A', uom: 'PCS',
        siteCode: 'WH', qtyOrdered: 5, unitPrice: -1,
      }],
    });
    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({
        message: 'lines[0].unitPrice must be greater than or equal to 0',
        statusCode: 422,
      });
  });

  test('rejects non-finite numeric values', async () => {
    const db = mockDb(null);
    const payload = validPayload({
      lines: [{ prLineId: 'pr-1', qtyOrdered: Infinity, unitPrice: NaN }],
    });

    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({
        message: 'lines[0].qtyOrdered must be greater than 0',
        statusCode: 422,
      });
  });
});

// ─────────────────────────────────────────────────────────
// Over-allocation Guard
// ─────────────────────────────────────────────────────────

describe('createPurchaseOrder – over-allocation guard', () => {
  test('rejects when allocation qty exceeds PR line remaining qty', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{ id: 'pr-line-001', qty_requested: 10, qty_allocated: 7, pr_status: 'APPROVED' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    // Requesting 5 but only 3 remaining (10 - 7)
    const payload = validPayload({ lines: [{ ...validPayload().lines[0], qtyOrdered: 5 }] });

    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({
        message: 'lines[0]: allocation qty 5 exceeds remaining 3',
        statusCode: 422,
      });

    // Verify ROLLBACK was called
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('allows allocation when qty equals exact remaining', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{ id: 'pr-line-001', qty_requested: 10, qty_allocated: 5, pr_status: 'APPROVED' }],
          rowCount: 1,
        };
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ total: 0 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const db = mockDb(client, detailQueryResponses());

    // Requesting exactly 5 with 5 remaining
    const payload = validPayload({ lines: [{ ...validPayload().lines[0], qtyOrdered: 5 }] });

    const result = await createPurchaseOrder(db, payload);
    expect(result).toBeDefined();
    expect(result.status).toBe('DRAFT');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('rejects when PR line does not exist', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return { rows: [], rowCount: 0 }; // Not found
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createPurchaseOrder(db, validPayload()))
      .rejects.toMatchObject({
        message: 'lines[0]: PR line not found',
        statusCode: 422,
      });
  });
});

// ─────────────────────────────────────────────────────────
// PR Status Check
// ─────────────────────────────────────────────────────────

describe('createPurchaseOrder – PR status check', () => {
  test('rejects when PR is in DRAFT status', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{ id: 'pr-line-001', qty_requested: 10, qty_allocated: 0, pr_status: 'DRAFT' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createPurchaseOrder(db, validPayload()))
      .rejects.toMatchObject({
        message: 'lines[0]: PR must be APPROVED before allocation',
        statusCode: 422,
      });
  });

  test('rejects when PR is in SUBMITTED status', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{ id: 'pr-line-001', qty_requested: 10, qty_allocated: 0, pr_status: 'SUBMITTED' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createPurchaseOrder(db, validPayload()))
      .rejects.toMatchObject({
        message: 'lines[0]: PR must be APPROVED before allocation',
        statusCode: 422,
      });
  });
});

describe('createPurchaseOrder – source PR rule', () => {
  test('rejects lines from different PRs', async () => {
    const client = mockClient((sql, params) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            id: params[0], pr_id: params[0] === 'line-1' ? 'pr-1' : 'pr-2',
            qty_requested: 10, qty_allocated: 0, pr_status: 'APPROVED',
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);
    const payload = validPayload({
      lines: [
        { prLineId: 'line-1', qtyOrdered: 1, unitPrice: 100 },
        { prLineId: 'line-2', qtyOrdered: 1, unitPrice: 100 },
      ],
    });

    await expect(createPurchaseOrder(db, payload))
      .rejects.toMatchObject({
        message: 'lines[1]: all PO lines must belong to the same PR',
        statusCode: 422,
      });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

// ─────────────────────────────────────────────────────────
// Successful PO Creation
// ─────────────────────────────────────────────────────────

describe('createPurchaseOrder – success path', () => {
  test('creates PO and returns detail with DRAFT status', async () => {
    const client = mockClient(happyPathClientResponses());
    const db = mockDb(client, detailQueryResponses());

    const result = await createPurchaseOrder(db, validPayload());

    expect(result.poNumber).toBe('PO-2026-0004');
    expect(result.status).toBe('DRAFT');
    expect(result.vendorName).toBe('PT Supplier Jaya');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].itemCode).toBe('BRG-001');
    expect(result.lines[0].qtyOrdered).toBe(5);
    expect(result.lines[0].allocations).toHaveLength(1);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('copies item metadata from the locked PR line', async () => {
    const client = mockClient(happyPathClientResponses());
    const db = mockDb(client, detailQueryResponses());

    await createPurchaseOrder(db, validPayload());

    const lineInsert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO po_lines'));
    expect(lineInsert[1].slice(3, 10)).toEqual([
      'BRG-001', 'Safety Helmet', 5, 'PCS', 150000, 'WH-JKT', null,
    ]);
  });

  test('rolls back and releases client on unexpected error', async () => {
    const client = mockClient((sql) => {
      if (sql === 'BEGIN') return { rows: [], rowCount: 0 };
      if (sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [{ id: 'pr-line-001', qty_requested: 10, qty_allocated: 0, pr_status: 'APPROVED' }],
          rowCount: 1,
        };
      }
      if (sql.includes('COUNT(*)')) {
        throw new Error('DB connection lost');
      }
      return { rows: [], rowCount: 0 };
    });
    const db = mockDb(client);

    await expect(createPurchaseOrder(db, validPayload()))
      .rejects.toThrow('DB connection lost');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// Submit PO – Status Transition
// ─────────────────────────────────────────────────────────

describe('submitPurchaseOrder – status transition', () => {
  test('returns null when PO does not exist', async () => {
    const db = mockDb(null, () => ({ rows: [], rowCount: 0 }));

    const result = await submitPurchaseOrder(db, 'non-existent-id');
    expect(result).toBeNull();
  });

  test('submits a DRAFT PO successfully', async () => {
    let callCount = 0;
    const db = {
      query: jest.fn((sql) => {
        // First call: SELECT status
        if (sql.includes('SELECT id, status') && callCount === 0) {
          callCount++;
          return { rows: [{ id: 'po-1', status: 'DRAFT' }], rowCount: 1 };
        }
        // Second call: UPDATE
        if (sql.includes('UPDATE purchase_orders')) {
          return { rows: [], rowCount: 1 };
        }
        // getPurchaseOrderById calls
        if (sql.includes('FROM purchase_orders WHERE id')) {
          return {
            rows: [{
              id: 'po-1', po_number: 'PO-2026-0001', status: 'SUBMITTED',
              vendor_name: 'PT Jaya', created_at: new Date(), updated_at: new Date(),
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM po_lines')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const result = await submitPurchaseOrder(db, 'po-1');
    expect(result.status).toBe('SUBMITTED');
    expect(result.poNumber).toBe('PO-2026-0001');
  });

  test('rejects submit when PO is already SUBMITTED', async () => {
    const db = mockDb(null, () => ({
      rows: [{ id: 'po-1', status: 'SUBMITTED' }],
      rowCount: 1,
    }));

    await expect(submitPurchaseOrder(db, 'po-1'))
      .rejects.toMatchObject({
        message: 'Only DRAFT purchase order can be submitted',
        statusCode: 422,
      });
  });

  test('rejects submit when PO is CANCELLED', async () => {
    const db = mockDb(null, () => ({
      rows: [{ id: 'po-1', status: 'CANCELLED' }],
      rowCount: 1,
    }));

    await expect(submitPurchaseOrder(db, 'po-1'))
      .rejects.toMatchObject({
        message: 'Only DRAFT purchase order can be submitted',
        statusCode: 422,
      });
  });
});

describe('purchase-order-service list functions', () => {
  test('listPurchaseOrders returns an empty list when no records exist', async () => {
    const db = { query: jest.fn(() => ({ rows: [] })) };

    const result = await listPurchaseOrders(db);

    expect(result).toEqual([]);
  });

  test('listPurchaseOrders returns mapped header fields', async () => {
    const db = {
      query: jest.fn(() => ({
        rows: [
          {
            id: 'po-1',
            po_number: 'PO-2026-0001',
            status: 'DRAFT',
            vendor_name: 'PT Maju',
            created_at: '2026-05-01T10:00:00.000Z',
            updated_at: '2026-05-01T10:00:00.000Z',
          },
        ],
      })),
    };

    const result = await listPurchaseOrders(db);

    expect(result).toEqual([
      {
        id: 'po-1',
        poNumber: 'PO-2026-0001',
        status: 'DRAFT',
        vendorName: 'PT Maju',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]);
  });

  test('getOpenPoLines returns null when PO not found', async () => {
    const db = { query: jest.fn(() => ({ rows: [], rowCount: 0 })) };

    const result = await getOpenPoLines(db, 'missing-id');

    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('getOpenPoLines returns only lines with qtyOpenForGr greater than 0', async () => {
    let call = 0;
    const db = {
      query: jest.fn(() => {
        call += 1;
        if (call === 1) {
          return {
            rows: [{ id: 'po-1', po_number: 'PO-2026-0001', status: 'SUBMITTED' }],
            rowCount: 1,
          };
        }
        return {
          rows: [
            {
              id: 'po-line-1',
              line_no: 1,
              item_code: 'A',
              item_name: 'Item A',
              qty_ordered: 10,
              qty_received: 4,
              uom: 'PCS',
              unit_price: 1000,
              site_code: 'JKT',
              required_date: null,
            },
            {
              id: 'po-line-2',
              line_no: 2,
              item_code: 'B',
              item_name: 'Item B',
              qty_ordered: 3,
              qty_received: 3,
              uom: 'PCS',
              unit_price: 2000,
              site_code: 'JKT',
              required_date: null,
            },
          ],
          rowCount: 2,
        };
      }),
    };

    const result = await getOpenPoLines(db, 'po-1');

    expect(result.purchaseOrder).toEqual({
      id: 'po-1',
      poNumber: 'PO-2026-0001',
      status: 'SUBMITTED',
    });
    expect(result.openLines).toHaveLength(1);
    expect(result.openLines[0].id).toBe('po-line-1');
    expect(result.openLines[0].qtyOpenForGr).toBe(6);
  });
});
