import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PurchaseOrderDetailPage from './PurchaseOrderDetailPage.vue';

const mocks = vi.hoisted(() => ({
  getPurchaseOrder: vi.fn(),
  submitPurchaseOrder: vi.fn(),
}));

vi.mock('../api', () => ({ api: mocks }));

vi.mock('vue-router', async () => {
  const router = await vi.importActual('vue-router');
  return {
    ...router,
    useRoute: () => ({ params: { id: 'po-1' } }),
  };
});

function purchaseOrder(status = 'DRAFT') {
  return {
    id: 'po-1',
    poNumber: 'PO-2026-0001',
    vendorName: 'PT Supplier Jaya',
    status,
    createdAt: '2026-09-03T08:00:00.000Z',
    lines: [{
      id: 'line-1', lineNo: 1, itemCode: 'BRG-001', itemName: 'Bearing',
      qtyOrdered: 5, qtyReceived: 0, qtyOpenForGr: 5, uom: 'PCS',
      unitPrice: 150000, siteCode: 'JKT', requiredDate: '2026-09-30',
      allocations: [{ prLineId: 'pr-line-1', prNumber: 'PR-2026-0001', allocatedQty: 5 }],
    }],
  };
}

function mountPage() {
  return mount(PurchaseOrderDetailPage, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

describe('PurchaseOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders PO lines and their source PR allocation', async () => {
    mocks.getPurchaseOrder.mockResolvedValue(purchaseOrder());

    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.getPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(wrapper.text()).toContain('PO-2026-0001');
    expect(wrapper.get('tbody').text()).toContain('BRG-001');
    expect(wrapper.get('tbody').text()).toContain('PR-2026-0001 (5)');
  });

  test('submits a DRAFT PO and removes the submit action', async () => {
    mocks.getPurchaseOrder.mockResolvedValue(purchaseOrder());
    mocks.submitPurchaseOrder.mockResolvedValue(purchaseOrder('SUBMITTED'));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(mocks.submitPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(wrapper.get('.status-badge').text()).toBe('SUBMITTED');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  test('does not show submit for an already submitted PO', async () => {
    mocks.getPurchaseOrder.mockResolvedValue(purchaseOrder('SUBMITTED'));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('button').exists()).toBe(false);
  });

  test('renders an API error', async () => {
    mocks.getPurchaseOrder.mockRejectedValue(new Error('Purchase order not found'));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('.error').text()).toBe('Purchase order not found');
  });
});