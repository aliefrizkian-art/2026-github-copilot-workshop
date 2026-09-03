import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PurchaseOrderCreatePage from './PurchaseOrderCreatePage.vue';

const apiMocks = vi.hoisted(() => ({
  listRequisitions: vi.fn(),
  getRequisitionOpenLines: vi.fn(),
  createPurchaseOrder: vi.fn(),
  submitPurchaseOrder: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../api', () => ({
  api: apiMocks,
}));

vi.mock('vue-router', async () => {
  const router = await vi.importActual('vue-router');
  return {
    ...router,
    useRouter: () => ({ push: apiMocks.push }),
  };
});

function openLinesPayload() {
  return {
    requisition: { id: 'pr-approved', prNumber: 'PR-2026-0001', status: 'APPROVED' },
    openLines: [{
      id: 'line-1',
      lineNo: 1,
      itemCode: 'BRG-001',
      itemName: 'Bearing',
      uom: 'PCS',
      qtyRequested: 10,
      qtyAllocated: 5,
      qtyOpenForPo: 5,
      estUnitPrice: 150000,
      siteCode: 'JKT',
      requiredDate: '2026-09-30',
    }],
  };
}

function mountPage() {
  return mount(PurchaseOrderCreatePage, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

async function selectApprovedLine(wrapper, quantity = 5) {
  await wrapper.get('#po-vendor').setValue('PT Supplier Jaya');
  await wrapper.get('#po-source-pr').setValue('pr-approved');
  await flushPromises();
  await wrapper.get('input[type="checkbox"]').setValue(true);
  await wrapper.get('.quantity-input').setValue(quantity);
}

describe('PurchaseOrderCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listRequisitions.mockResolvedValue({
      items: [
        { id: 'pr-approved', prNumber: 'PR-2026-0001', title: 'Bearings', status: 'APPROVED' },
        { id: 'pr-draft', prNumber: 'PR-2026-0002', title: 'Gloves', status: 'DRAFT' },
      ],
    });
    apiMocks.getRequisitionOpenLines.mockResolvedValue(openLinesPayload());
  });

  test('lists approved PRs and renders their open lines', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('#po-source-pr').text()).toContain('PR-2026-0001');
    expect(wrapper.get('#po-source-pr').text()).not.toContain('PR-2026-0002');

    await wrapper.get('#po-source-pr').setValue('pr-approved');
    await flushPromises();

    expect(apiMocks.getRequisitionOpenLines).toHaveBeenCalledWith('pr-approved');
    expect(wrapper.get('tbody').text()).toContain('BRG-001');
    expect(wrapper.get('tbody').text()).toContain('Bearing');
  });

  test('blocks an allocation above the PR remaining quantity', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await selectApprovedLine(wrapper, 6);

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save As Draft'));
    await saveButton.trigger('click');

    expect(apiMocks.createPurchaseOrder).not.toHaveBeenCalled();
    expect(wrapper.get('.error').text()).toContain('allocation quantity 6 exceeds remaining 5');
    expect(wrapper.get('.line-error').text()).toBe('Maximum 5');
  });

  test('shows a clear 422 message returned by the API', async () => {
    apiMocks.createPurchaseOrder.mockRejectedValue(
      new Error('lines[0]: allocation qty 5 exceeds remaining 3'),
    );
    const wrapper = mountPage();
    await flushPromises();
    await selectApprovedLine(wrapper, 5);

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save As Draft'));
    await saveButton.trigger('click');
    await flushPromises();

    expect(wrapper.get('.error').text()).toBe('lines[0]: allocation qty 5 exceeds remaining 3');
  });

  test('creates a PO and then submits it', async () => {
    apiMocks.createPurchaseOrder.mockResolvedValue({
      id: 'po-1', poNumber: 'PO-2026-0002', status: 'DRAFT',
    });
    apiMocks.submitPurchaseOrder.mockResolvedValue({
      id: 'po-1', poNumber: 'PO-2026-0002', status: 'SUBMITTED',
    });
    const wrapper = mountPage();
    await flushPromises();
    await selectApprovedLine(wrapper, 4);

    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('Submit PO'));
    await submitButton.trigger('click');
    await flushPromises();

    expect(apiMocks.createPurchaseOrder).toHaveBeenCalledWith({
      vendorName: 'PT Supplier Jaya',
      lines: [{ prLineId: 'line-1', qtyOrdered: 4, unitPrice: 150000 }],
    });
    expect(apiMocks.submitPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(wrapper.get('.success').text()).toBe('PO-2026-0002 saved as SUBMITTED.');
    expect(apiMocks.push).toHaveBeenCalledWith('/purchase-orders/po-1');
  });
});