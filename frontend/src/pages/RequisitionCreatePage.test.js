import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RequisitionCreatePage from './RequisitionCreatePage.vue';

const mocks = vi.hoisted(() => ({
  createRequisition: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    createRequisition: mocks.createRequisition,
  },
}));

vi.mock('vue-router', async () => {
  const router = await vi.importActual('vue-router');
  return {
    ...router,
    useRouter: () => ({ push: mocks.push }),
  };
});

function mountPage() {
  return mount(RequisitionCreatePage, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
      },
    },
  });
}

describe('RequisitionCreatePage', () => {
  beforeEach(() => {
    mocks.createRequisition.mockReset();
    mocks.push.mockReset();
  });

  test('renders required fields and numeric limits', () => {
    const wrapper = mountPage();
    const quantity = wrapper.get('input[type="number"][min="0.01"]');
    const unitPrice = wrapper.get('input[type="number"][min="0"]');

    expect(wrapper.findAll('input[required]')).toHaveLength(9);
    expect(quantity.attributes('step')).toBe('0.01');
    expect(unitPrice.attributes('step')).toBe('0.01');
  });

  test('adds and removes lines but keeps at least one', async () => {
    const wrapper = mountPage();
    const addButton = wrapper.findAll('button').find((button) => button.text().includes('New Line'));

    await addButton.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);

    await wrapper.findAll('button[title="Remove"]')[0].trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);

    await wrapper.get('button[title="Remove"]').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
  });

  test('submits a copied payload and redirects to detail', async () => {
    mocks.createRequisition.mockResolvedValue({ id: 'pr-created' });
    const wrapper = mountPage();
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('Rina');
    await inputs[1].setValue('Operations');
    await inputs[2].setValue('Replacement bearings');
    await inputs[4].setValue('BRG-001');
    await inputs[5].setValue('Bearing');
    await inputs[6].setValue('5');
    await inputs[7].setValue('PCS');
    await inputs[8].setValue('150000');
    await inputs[9].setValue('JKT');

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.createRequisition).toHaveBeenCalledWith(expect.objectContaining({
      requesterName: 'Rina',
      departmentName: 'Operations',
      title: 'Replacement bearings',
      lines: [expect.objectContaining({
        itemCode: 'BRG-001',
        qtyRequested: 5,
        estUnitPrice: 150000,
      })],
    }));
    expect(mocks.push).toHaveBeenCalledWith('/requisitions/pr-created');
  });

  test('renders an API validation error', async () => {
    mocks.createRequisition.mockRejectedValue(new Error('Quantity must be greater than zero'));
    const wrapper = mountPage();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.error').text()).toBe('Quantity must be greater than zero');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});