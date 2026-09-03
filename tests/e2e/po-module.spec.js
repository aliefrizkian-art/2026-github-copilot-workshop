const { test, expect } = require('@playwright/test');

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

async function createApprovedRequisition(request, testInfo) {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const itemCode = `E2E-${suffix}`;
  const createResponse = await request.post(`${API_BASE_URL}/api/requisitions`, {
    data: {
      requesterName: 'Playwright User',
      departmentName: 'Quality Assurance',
      title: `PO E2E ${suffix}`,
      neededByDate: '2026-12-15',
      lines: [{
        itemCode,
        itemName: 'E2E Test Item',
        qtyRequested: 10,
        uom: 'PCS',
        estUnitPrice: 25000,
        siteCode: 'JKT',
        requiredDate: '2026-12-15',
      }],
    },
  });
  expect(createResponse.status(), await createResponse.text()).toBe(201);
  const requisition = await createResponse.json();

  const submitResponse = await request.post(
    `${API_BASE_URL}/api/requisitions/${requisition.id}/submit`,
  );
  expect(submitResponse.status(), await submitResponse.text()).toBe(200);

  const approveResponse = await request.post(
    `${API_BASE_URL}/api/requisitions/${requisition.id}/approve`,
  );
  expect(approveResponse.status(), await approveResponse.text()).toBe(200);

  return {
    id: requisition.id,
    prNumber: requisition.prNumber,
    prLineId: requisition.lines[0].id,
    itemCode,
    remainingQty: 10,
  };
}

test.describe('Purchase order module', () => {
  test('creates and submits a PO from an approved PR line', async ({ page, request }, testInfo) => {
    const requisition = await createApprovedRequisition(request, testInfo);

    await page.goto('/purchase-orders/new');
    await page.getByLabel('Vendor').fill('PT Playwright Supplier');
    await page.getByLabel('Approved PR').selectOption(requisition.id);

    const selectLine = page.getByLabel(`Select ${requisition.itemCode}`);
    await expect(selectLine).toBeVisible();
    await selectLine.check();
    await page.getByLabel(`Order quantity for ${requisition.itemCode}`).fill('6');
    await page.getByLabel(`Unit price for ${requisition.itemCode}`).fill('27500');

    await page.getByRole('button', { name: 'Submit PO' }).click();

    await expect(page).toHaveURL(/\/purchase-orders\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'Purchase Order Detail' })).toBeVisible();
    await expect(page.locator('.status-badge')).toHaveText('SUBMITTED');
    await expect(page.getByRole('cell', { name: requisition.itemCode })).toBeVisible();
    await expect(page.getByRole('cell', { name: `${requisition.prNumber} (6)` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit PO' })).toHaveCount(0);
  });

  test('rejects an allocation above the PR remaining quantity', async ({ page, request }, testInfo) => {
    const requisition = await createApprovedRequisition(request, testInfo);
    const excessiveQty = requisition.remainingQty + 1;

    await page.goto('/purchase-orders/new');
    await page.getByLabel('Vendor').fill('PT Invalid Allocation');
    await page.getByLabel('Approved PR').selectOption(requisition.id);
    await page.getByLabel(`Select ${requisition.itemCode}`).check();
    await page.getByLabel(`Order quantity for ${requisition.itemCode}`).fill(String(excessiveQty));

    await page.getByRole('button', { name: 'Save As Draft' }).click();

    await expect(page).toHaveURL(/\/purchase-orders\/new$/);
    await expect(page.locator('.error.po-message')).toContainText(
      `allocation quantity ${excessiveQty} exceeds remaining ${requisition.remainingQty}`,
    );
    await expect(page.getByText(`Maximum ${requisition.remainingQty}`)).toBeVisible();

    const apiResponse = await request.post(`${API_BASE_URL}/api/purchase-orders`, {
      data: {
        vendorName: 'PT Invalid Allocation',
        lines: [{
          prLineId: requisition.prLineId,
          qtyOrdered: excessiveQty,
          unitPrice: 25000,
        }],
      },
    });
    expect(apiResponse.status()).toBe(422);
    await expect(apiResponse.json()).resolves.toEqual({
      message: `lines[0]: allocation qty ${excessiveQty} exceeds remaining ${requisition.remainingQty}`,
    });
  });
});