<template>
  <section class="po-create-page">
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/purchase-orders" class="back-btn" title="Back to list">
          <span class="back-icon-box"><img src="../assets/po-create/arrow-back.svg" alt="" /></span>
        </RouterLink>
        <div>
          <h2>Create Purchase Order</h2>
          <p class="muted">Pick approved PR lines and allocate order quantities</p>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="error po-message">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success po-message">{{ successMessage }}</p>

    <PurchaseOrderHeaderForm v-model="header" :requisitions="approvedRequisitions" />
    <LineAllocationTable :lines="lines" :loading="loadingLines" @refresh="loadOpenLines" />

    <section class="card-panel po-summary" aria-label="Purchase order summary">
      <div>
        <span>Selected Lines</span>
        <strong>{{ selectedLineCount }}</strong>
      </div>
      <div class="summary-total">
        <span>Estimated Total</span>
        <strong>{{ formatAmount(estimatedTotal) }}</strong>
      </div>
    </section>

    <div class="btn-group po-actions">
      <button class="btn btn-draft" type="button" :disabled="saving" @click="savePurchaseOrder(false)">
        Save As Draft
      </button>
      <button class="btn btn-primary" type="button" :disabled="saving" @click="savePurchaseOrder(true)">
        {{ saving ? 'Saving...' : 'Submit PO' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import LineAllocationTable from '../components/po/LineAllocationTable.vue';
import PurchaseOrderHeaderForm from '../components/po/PurchaseOrderHeaderForm.vue';

const router = useRouter();
const header = ref({
  vendorName: '',
  sourcePrId: '',
  neededByDate: '',
  currency: 'IDR',
  paymentTerms: '',
  notes: '',
});

const approvedRequisitions = ref([]);
const lines = reactive([]);
const loadingLines = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const selectedLineCount = computed(() => lines.filter((line) => line.selected).length);
const estimatedTotal = computed(() => lines
  .filter((line) => line.selected)
  .reduce((total, line) => total + (Number(line.orderQty) || 0) * (Number(line.unitPrice) || 0), 0));

function formatAmount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function validateSelectedLines(selectedLines) {
  if (!header.value.vendorName.trim()) return 'Vendor is required.';
  if (!header.value.sourcePrId) return 'Select an approved PR.';
  if (selectedLines.length === 0) return 'Select at least one PR line.';

  for (const line of lines) line.error = '';
  for (const line of selectedLines) {
    const orderQty = Number(line.orderQty);
    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(orderQty) || orderQty <= 0) {
      line.error = 'Enter a quantity greater than 0.';
      return `${line.itemCode}: order quantity must be greater than 0.`;
    }
    if (orderQty > line.remainingQty) {
      line.error = `Maximum ${line.remainingQty}`;
      return `${line.itemCode}: allocation quantity ${orderQty} exceeds remaining ${line.remainingQty}.`;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return `${line.itemCode}: unit price must be 0 or greater.`;
    }
  }

  return '';
}

async function loadRequisitions() {
  try {
    const payload = await api.listRequisitions();
    approvedRequisitions.value = (payload.items || []).filter((item) => item.status === 'APPROVED');
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function loadOpenLines() {
  lines.splice(0);
  if (!header.value.sourcePrId) return;

  loadingLines.value = true;
  errorMessage.value = '';
  try {
    const payload = await api.getRequisitionOpenLines(header.value.sourcePrId);
    lines.push(...payload.openLines.map((line) => ({
      id: line.id,
      selected: false,
      prNumber: payload.requisition.prNumber,
      prLine: line.lineNo,
      itemCode: line.itemCode,
      itemName: line.itemName,
      uom: line.uom,
      requestedQty: line.qtyRequested,
      allocatedQty: line.qtyAllocated,
      remainingQty: line.qtyOpenForPo,
      orderQty: 0,
      deliveryAddress: line.siteCode,
      deliveryDate: line.requiredDate || '',
      unitPrice: line.estUnitPrice,
      error: '',
    })));
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loadingLines.value = false;
  }
}

async function savePurchaseOrder(shouldSubmit) {
  const selectedLines = lines.filter((line) => line.selected);
  const validationError = validateSelectedLines(selectedLines);
  errorMessage.value = validationError;
  successMessage.value = '';
  if (validationError) return;

  saving.value = true;
  try {
    const created = await api.createPurchaseOrder({
      vendorName: header.value.vendorName.trim(),
      lines: selectedLines.map((line) => ({
        prLineId: line.id,
        qtyOrdered: Number(line.orderQty),
        unitPrice: Number(line.unitPrice),
      })),
    });
    const purchaseOrder = shouldSubmit ? await api.submitPurchaseOrder(created.id) : created;
    successMessage.value = `${purchaseOrder.poNumber} saved as ${purchaseOrder.status}.`;
    await router.push(`/purchase-orders/${purchaseOrder.id}`);
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    saving.value = false;
  }
}

watch(() => header.value.sourcePrId, loadOpenLines);
onMounted(loadRequisitions);
</script>

<style scoped>
.po-create-page {
  width: 100%;
}

.po-message {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 5px;
  background: #ffebee;
}

.success {
  color: #2e7d32;
  background: #e8f5e9;
}

.back-btn {
  width: 45px;
  height: 45px;
}

.back-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.back-icon-box img {
  width: 16px;
  height: 16px;
}

.po-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.po-summary div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.po-summary span {
  font-size: 13px;
}

.po-summary strong {
  font-size: 32px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
}

.summary-total {
  align-items: flex-end;
  text-align: right;
}

.po-actions .btn {
  min-height: 45px;
}

.po-actions .btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-draft {
  background: #fdb702;
  color: var(--white);
}

@media (max-width: 560px) {
  .po-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-total {
    align-items: flex-start;
    text-align: left;
  }
}
</style>