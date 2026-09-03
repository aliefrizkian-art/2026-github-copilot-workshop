import { v4 as uuidv4 } from 'uuid';

// ── Mappers ──────────────────────────────────────────────

function mapHeader(row) {
  return {
    id: row.id,
    grNumber: row.gr_number,
    status: row.status,
    poId: row.po_id,
    receiptDate: row.receipt_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLine(row) {
  return {
    id: row.id,
    lineNo: row.line_no,
    poLineId: row.po_line_id,
    qtyReceived: Number(row.qty_received),
    actualSiteCode: row.actual_site_code,
  };
}

function createGrNumber(count) {
  const next = String(Number(count) + 1).padStart(4, '0');
  return `GR-2026-${next}`;
}

// ── Validation ───────────────────────────────────────────

function validateCreatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Body is required';
  }

  if (!payload.poId || typeof payload.poId !== 'string') {
    return 'poId is required';
  }

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return 'lines must contain at least one item';
  }

  const poLineIds = new Set();
  for (let i = 0; i < payload.lines.length; i++) {
    const line = payload.lines[i];

    if (!line.poLineId) {
      return `lines[${i}].poLineId is required`;
    }

    if (poLineIds.has(line.poLineId)) {
      return `lines[${i}].poLineId duplicates an earlier line`;
    }
    poLineIds.add(line.poLineId);

    const qtyReceived = Number(line.qtyReceived);
    if (!Number.isFinite(qtyReceived) || qtyReceived <= 0) {
      return `lines[${i}].qtyReceived must be greater than 0`;
    }

    if (!line.actualSiteCode || typeof line.actualSiteCode !== 'string') {
      return `lines[${i}].actualSiteCode is required`;
    }
  }

  if (payload.receiptDate && typeof payload.receiptDate !== 'string') {
    return 'receiptDate must be a valid date string';
  }

  return null;
}

// ── Queries ──────────────────────────────────────────────

export async function listGoodsReceipts(db) {
  const { rows } = await db.query(
    `SELECT id, gr_number, status, po_id, receipt_date, notes, created_at, updated_at
     FROM goods_receipts
     ORDER BY created_at DESC`
  );

  return rows.map(mapHeader);
}

export async function getGoodsReceiptById(db, id) {
  const headerResult = await db.query(
    `SELECT * FROM goods_receipts WHERE id = $1`,
    [id]
  );

  if (headerResult.rowCount === 0) {
    return null;
  }

  const poResult = await db.query(
    `SELECT po_number, vendor_name, status FROM purchase_orders WHERE id = $1`,
    [headerResult.rows[0].po_id]
  );

  const linesResult = await db.query(
    `SELECT gr.id, gr.line_no, gr.po_line_id, gr.qty_received, gr.actual_site_code,
            pl.item_code, pl.item_name, pl.uom, pl.qty_ordered, pl.qty_received, pl.unit_price
     FROM gr_lines gr
     JOIN po_lines pl ON pl.id = gr.po_line_id
     WHERE gr.gr_id = $1
     ORDER BY gr.line_no ASC`,
    [id]
  );

  const lines = linesResult.rows.map((row) => ({
    ...mapLine(row),
    itemCode: row.item_code,
    itemName: row.item_name,
    uom: row.uom,
    qtyOrdered: Number(row.qty_ordered),
    qtyPreviouslyReceived: Number(row.qty_received) - Number(row.qty_received), // This will be 0 for new lines
    unitPrice: Number(row.unit_price),
  }));

  const gr = mapHeader(headerResult.rows[0]);
  gr.purchaseOrder = poResult.rowCount > 0 ? {
    id: headerResult.rows[0].po_id,
    poNumber: poResult.rows[0].po_number,
    vendorName: poResult.rows[0].vendor_name,
    status: poResult.rows[0].status,
  } : null;
  gr.lines = lines;

  return gr;
}

export async function getOpenPoLines(db, poId) {
  const headerResult = await db.query(
    `SELECT id, po_number, status FROM purchase_orders WHERE id = $1`,
    [poId]
  );

  if (headerResult.rowCount === 0) {
    return null;
  }

  if (headerResult.rows[0].status !== 'SUBMITTED') {
    const err = new Error('PO must be SUBMITTED before creating GR');
    err.statusCode = 422;
    throw err;
  }

  const linesResult = await db.query(
    `SELECT id, line_no, item_code, item_name, uom, qty_ordered, qty_received, 
            unit_price, site_code, required_date
     FROM po_lines WHERE po_id = $1 ORDER BY line_no ASC`,
    [poId]
  );

  const openLines = linesResult.rows
    .map((row) => ({
      id: row.id,
      lineNo: row.line_no,
      itemCode: row.item_code,
      itemName: row.item_name,
      uom: row.uom,
      qtyOrdered: Number(row.qty_ordered),
      qtyReceived: Number(row.qty_received),
      qtyOpenForGr: Number(row.qty_ordered) - Number(row.qty_received),
      unitPrice: Number(row.unit_price),
      siteCode: row.site_code,
      requiredDate: row.required_date,
    }))
    .filter((line) => line.qtyOpenForGr > 0);

  return {
    purchaseOrder: {
      id: headerResult.rows[0].id,
      poNumber: headerResult.rows[0].po_number,
      status: headerResult.rows[0].status,
    },
    openLines,
  };
}

// ── Create GR (with over-receipt guard) ───────────────

export async function createGoodsReceipt(db, payload) {
  const validationError = validateCreatePayload(payload);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 422;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify PO exists and is SUBMITTED
    const poResult = await client.query(
      `SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [payload.poId]
    );

    if (poResult.rowCount === 0) {
      const err = new Error('Purchase order not found');
      err.statusCode = 422;
      throw err;
    }

    if (poResult.rows[0].status !== 'SUBMITTED') {
      const err = new Error('PO must be SUBMITTED before creating GR');
      err.statusCode = 422;
      throw err;
    }

    const lockedPoLines = new Map();

    // Lock and validate every referenced PO line
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];

      const poLineResult = await client.query(
        `SELECT id, qty_ordered, qty_received, item_code, item_name, uom, 
                unit_price, site_code, required_date
         FROM po_lines
         WHERE id = $1 AND po_id = $2
         FOR UPDATE`,
        [line.poLineId, payload.poId]
      );

      if (poLineResult.rowCount === 0) {
        const err = new Error(`lines[${i}]: PO line not found`);
        err.statusCode = 422;
        throw err;
      }

      const poLine = poLineResult.rows[0];
      const remaining = Number(poLine.qty_ordered) - Number(poLine.qty_received);

      if (Number(line.qtyReceived) > remaining) {
        const err = new Error(
          `lines[${i}]: receipt qty ${line.qtyReceived} exceeds remaining ${remaining}`
        );
        err.statusCode = 422;
        throw err;
      }

      lockedPoLines.set(line.poLineId, poLine);
    }

    // Generate GR number
    const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM goods_receipts`);
    const grNumber = createGrNumber(countResult.rows[0].total);
    const grId = uuidv4();

    const receiptDate = payload.receiptDate || new Date().toISOString().split('T')[0];

    // Insert GR header
    await client.query(
      `INSERT INTO goods_receipts (id, gr_number, status, po_id, receipt_date, notes)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5)`,
      [grId, grNumber, payload.poId, receiptDate, payload.notes || null]
    );

    // Insert GR lines
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];

      await client.query(
        `INSERT INTO gr_lines (id, gr_id, po_line_id, line_no, qty_received, actual_site_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          grId,
          line.poLineId,
          i + 1,
          Number(line.qtyReceived),
          line.actualSiteCode.trim(),
        ]
      );
    }

    await client.query('COMMIT');

    return getGoodsReceiptById(db, grId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ── Post GR (DRAFT → POSTED) ───────────────────────

export async function postGoodsReceipt(db, id) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT id, status, po_id FROM goods_receipts WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (currentResult.rowCount === 0) {
      const err = new Error('Goods receipt not found');
      err.statusCode = 404;
      throw err;
    }

    const gr = currentResult.rows[0];

    if (gr.status !== 'DRAFT') {
      const err = new Error(`Cannot post a ${gr.status} goods receipt`);
      err.statusCode = 422;
      throw err;
    }

    // Get all GR lines
    const linesResult = await client.query(
      `SELECT po_line_id, qty_received FROM gr_lines WHERE gr_id = $1`,
      [id]
    );

    // Update PO lines and PR lines (through allocations)
    for (const grLine of linesResult.rows) {
      const poLineId = grLine.po_line_id;
      const qtyReceived = grLine.qty_received;

      // Update PO line qty_received
      await client.query(
        `UPDATE po_lines
         SET qty_received = qty_received + $1, updated_at = NOW()
         WHERE id = $2`,
        [qtyReceived, poLineId]
      );

      // Update PR lines through allocations
      const allocResult = await client.query(
        `SELECT pr_line_id, allocated_qty FROM pr_line_allocations WHERE po_line_id = $1`,
        [poLineId]
      );

      for (const alloc of allocResult.rows) {
        const prLineId = alloc.pr_line_id;
        const prQtyToReceive = Math.min(Number(qtyReceived), Number(alloc.allocated_qty));

        await client.query(
          `UPDATE pr_lines
           SET qty_received = qty_received + $1, updated_at = NOW()
           WHERE id = $2`,
          [prQtyToReceive, prLineId]
        );
      }
    }

    // Update GR status to POSTED
    await client.query(
      `UPDATE goods_receipts
       SET status = 'POSTED', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    return getGoodsReceiptById(db, id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
