<template>
  <section>
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/purchase-orders" class="back-btn" title="Back to list">&#8592;</RouterLink>
        <div>
          <h2>Purchase Order Detail</h2>
          <p class="muted">{{ purchaseOrder?.poNumber || '-' }} &mdash; Purchase order information</p>
        </div>
      </div>
      <button
        v-if="purchaseOrder?.status === 'DRAFT'"
        class="btn btn-primary"
        type="button"
        :disabled="submitting"
        @click="submitPurchaseOrder"
      >
        {{ submitting ? 'Submitting...' : 'Submit PO' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="purchaseOrder" class="card-panel">
      <p class="form-section-title">PO Header</p>
      <div class="form-row po-header-grid">
        <div class="form-group">
          <label>PO Number</label>
          <input :value="purchaseOrder.poNumber" disabled />
        </div>
        <div class="form-group">
          <label>Vendor</label>
          <input :value="purchaseOrder.vendorName" disabled />
        </div>
        <div class="form-group">
          <label>Status</label>
          <span class="status-badge" :class="purchaseOrder.status.toLowerCase()">
            {{ purchaseOrder.status }}
          </span>
        </div>
        <div class="form-group">
          <label>Created At</label>
          <input :value="formatDate(purchaseOrder.createdAt)" disabled />
        </div>
      </div>
    </div>

    <div v-if="purchaseOrder" class="card-panel table-scroll">
      <p class="form-section-title">PO Lines</p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Source PR</th>
            <th>Ordered QTY</th>
            <th>Received QTY</th>
            <th>Open QTY</th>
            <th>UOM</th>
            <th>Unit Price</th>
            <th>Site</th>
            <th>Required Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in purchaseOrder.lines" :key="line.id">
            <td>{{ line.lineNo }}</td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ allocationLabel(line.allocations) }}</td>
            <td>{{ line.qtyOrdered }}</td>
            <td>{{ line.qtyReceived }}</td>
            <td>{{ line.qtyOpenForGr }}</td>
            <td>{{ line.uom }}</td>
            <td>{{ formatAmount(line.unitPrice) }}</td>
            <td>{{ line.siteCode }}</td>
            <td>{{ line.requiredDate || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const purchaseOrder = ref(null);
const errorMessage = ref('');
const submitting = ref(false);

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function allocationLabel(allocations = []) {
  return allocations.map((allocation) => (
    `${allocation.prNumber} (${allocation.allocatedQty})`
  )).join(', ') || '-';
}

async function load() {
  errorMessage.value = '';
  try {
    purchaseOrder.value = await api.getPurchaseOrder(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function submitPurchaseOrder() {
  errorMessage.value = '';
  submitting.value = true;
  try {
    purchaseOrder.value = await api.submitPurchaseOrder(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.form-group input:disabled {
  background: var(--white);
  color: var(--text);
  cursor: default;
  opacity: 1;
}

.status-badge {
  align-self: flex-start;
}

.table-scroll {
  overflow-x: auto;
}

table {
  min-width: 1080px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 900px) {
  .po-header-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .po-header-grid {
    grid-template-columns: 1fr;
  }
}
</style>