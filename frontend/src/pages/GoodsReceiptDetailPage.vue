<template>
  <section>
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/goods-receipts" class="back-btn" title="Back to list">&#8592;</RouterLink>
        <div>
          <h2>Goods Receipt Detail</h2>
          <p class="muted">{{ goodsReceipt?.grNumber || '-' }} &mdash; Goods receipt information</p>
        </div>
      </div>
      <button
        v-if="goodsReceipt?.status === 'DRAFT'"
        class="btn btn-primary"
        type="button"
        :disabled="posting"
        @click="postGoodsReceipt"
      >
        {{ posting ? 'Posting...' : 'Post GR' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="goodsReceipt" class="card-panel">
      <p class="form-section-title">GR Header</p>
      <div class="form-row gr-header-grid">
        <div class="form-group">
          <label>GR Number</label>
          <input :value="goodsReceipt.grNumber" disabled />
        </div>
        <div class="form-group">
          <label>Status</label>
          <span class="status-badge" :class="goodsReceipt.status.toLowerCase()">
            {{ goodsReceipt.status }}
          </span>
        </div>
        <div class="form-group">
          <label>Receipt Date</label>
          <input :value="formatDate(goodsReceipt.receiptDate)" disabled />
        </div>
        <div class="form-group">
          <label>Created At</label>
          <input :value="formatDate(goodsReceipt.createdAt)" disabled />
        </div>
      </div>

      <div v-if="goodsReceipt.notes" class="form-row">
        <div class="form-group">
          <label>Notes</label>
          <textarea :value="goodsReceipt.notes" disabled rows="3"></textarea>
        </div>
      </div>
    </div>

    <div v-if="goodsReceipt?.purchaseOrder" class="card-panel">
      <p class="form-section-title">Linked Purchase Order</p>
      <div class="form-row">
        <div class="form-group">
          <label>PO Number</label>
          <RouterLink
            :to="`/purchase-orders/${goodsReceipt.purchaseOrder.id}`"
            class="link"
          >
            {{ goodsReceipt.purchaseOrder.poNumber }}
          </RouterLink>
        </div>
        <div class="form-group">
          <label>Vendor</label>
          <input :value="goodsReceipt.purchaseOrder.vendorName" disabled />
        </div>
        <div class="form-group">
          <label>PO Status</label>
          <span class="status-badge" :class="goodsReceipt.purchaseOrder.status.toLowerCase()">
            {{ goodsReceipt.purchaseOrder.status }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="goodsReceipt" class="card-panel table-scroll">
      <p class="form-section-title">GR Lines</p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Receipt QTY</th>
            <th>UOM</th>
            <th>Site Code</th>
            <th>Unit Price</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="goodsReceipt.lines.length === 0">
            <td colspan="7" class="empty-cell">No lines</td>
          </tr>
          <tr v-for="line in goodsReceipt.lines" :key="line.id">
            <td>{{ line.lineNo }}</td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ line.qtyReceived }}</td>
            <td>{{ line.uom }}</td>
            <td>{{ line.actualSiteCode }}</td>
            <td>{{ formatAmount(line.unitPrice) }}</td>
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
const goodsReceipt = ref(null);
const errorMessage = ref('');
const posting = ref(false);

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

async function load() {
  errorMessage.value = '';
  try {
    goodsReceipt.value = await api.getGoodsReceipt(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function postGoodsReceipt() {
  errorMessage.value = '';
  posting.value = true;
  try {
    goodsReceipt.value = await api.postGoodsReceipt(route.params.id);
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    posting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.form-section-title {
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--text);
}

.gr-header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: var(--white);
  color: var(--text);
  cursor: default;
  opacity: 1;
}

.status-badge {
  align-self: flex-start;
}

.link {
  color: var(--primary);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.table-scroll {
  overflow-x: auto;
}

table {
  min-width: 900px;
}

.empty-cell {
  padding: 32px;
  color: var(--text-muted);
  text-align: center;
}
</style>
