import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PurchaseOrderListPage from './PurchaseOrderListPage.vue';

const apiMocks = vi.hoisted(() => ({
  listPurchaseOrders: vi.fn(),
}));

vi.mock('../api', () => ({ api: apiMocks }));

function mountPage() {
  return mount(PurchaseOrderListPage, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

describe('PurchaseOrderListPage', () => {
  beforeEach(() => {
    apiMocks.listPurchaseOrders.mockReset();
  });

  test('renders purchase orders returned by the API', async () => {
    apiMocks.listPurchaseOrders.mockResolvedValue({
      items: [{
        id: 'po-1',
        poNumber: 'PO-2026-0001',
        vendorName: 'PT Supplier Jaya',
        status: 'DRAFT',
        createdAt: '2026-09-03T08:00:00.000Z',
      }],
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('tbody').text()).toContain('PO-2026-0001');
    expect(wrapper.get('tbody').text()).toContain('PT Supplier Jaya');
    expect(wrapper.get('.status-badge').classes()).toContain('draft');
  });

  test('renders an empty state', async () => {
    apiMocks.listPurchaseOrders.mockResolvedValue({ items: [] });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('.empty-cell').text()).toBe('No purchase orders found.');
  });

  test('renders an API error', async () => {
    apiMocks.listPurchaseOrders.mockRejectedValue(new Error('Unable to load purchase orders'));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('.error').text()).toBe('Unable to load purchase orders');
  });
});