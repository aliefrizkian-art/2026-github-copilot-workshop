import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RequisitionListPage from './RequisitionListPage.vue';

const apiMocks = vi.hoisted(() => ({
  listRequisitions: vi.fn(),
}));

vi.mock('../api', () => ({
  api: apiMocks,
}));

function mountPage() {
  return mount(RequisitionListPage, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
      },
    },
  });
}

describe('RequisitionListPage', () => {
  beforeEach(() => {
    apiMocks.listRequisitions.mockReset();
  });

  test('renders requisitions returned by the list service', async () => {
    apiMocks.listRequisitions.mockResolvedValue({
      items: [
        {
          id: 'pr-1',
          prNumber: 'PR-2026-0001',
          requesterName: 'Rina',
          departmentName: 'Operations',
          title: 'Replacement bearings',
          status: 'APPROVED',
          neededByDate: '2026-09-15',
        },
      ],
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('tbody').text()).toContain('PR-2026-0001');
    expect(wrapper.get('tbody').text()).toContain('Rina');
    expect(wrapper.get('.status-badge').classes()).toContain('approved');
  });

  test('renders the service error', async () => {
    apiMocks.listRequisitions.mockRejectedValue(new Error('Unable to load requisitions'));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('.error').text()).toBe('Unable to load requisitions');
  });
});