<template>
  <section>
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/goods-receipts" class="back-btn" title="Back to list">&#8592;</RouterLink>
        <div>
          <h2>Create Goods Receipt</h2>
          <p class="muted">Create a new goods receipt from an open purchase order</p>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div class="card-panel">
      <p class="form-section-title">Step 1: Select Purchase Order</p>
      <div class="form-row">
        <div class="form-group">
          <label for="poSelect">Purchase Order *</label>
          <select
            id="poSelect"
            v-model="selectedPoId"
            @change="loadOpenLines"
            :disabled="loadingOpenLines"
          >
            <option value="">-- Select a PO --</option>
            <option v-for="po in purchaseOrders" :key="po.id" :value="po.id">
              {{ po.poNumber }} ({{ po.vendorName }})
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="selectedPoId && purchaseOrder" class="card-panel">
      <p class="form-section-title">Step 2: Select Items to Receive</p>
      <div class="form-row gr-header-grid">
        <div class="form-group">
          <label>PO Number</label>
          <input :value="purchaseOrder.poNumber" disabled />
        </div>
        <div class="form-group">
          <label>PO Status</label>
          <span class="status-badge" :class="purchaseOrder.status.toLowerCase()">
            {{ purchaseOrder.status }}
          </span>
        </div>
      </div>

      <p class="form-section-title">Available Lines</p>
      <div v-if="openLines.length === 0" class="info">
        No open lines available for receipt.
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Ordered QTY</th>
              <th>Received QTY</th>
              <th>Open QTY</th>
              <th>UOM</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in openLines" :key="line.id">
              <td>{{ line.lineNo }}</td>
              <td>{{ line.itemCode }}</td>
              <td>{{ line.itemName }}</td>
              <td>{{ line.qtyOrdered }}</td>
              <td>{{ line.qtyReceived }}</td>
              <td>{{ line.qtyOpenForGr }}</td>
              <td>{{ line.uom }}</td>
              <td>
                <button
                  class="btn btn-sm btn-outline"
                  @click="addLineToGr(line)"
                  :disabled="grLines.some(l => l.poLineId === line.id)"
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="grLines.length > 0" class="card-panel">
      <p class="form-section-title">Step 3: Receipt Details</p>
      <div class="form-row">
        <div class="form-group">
          <label for="receiptDate">Receipt Date</label>
          <input
            id="receiptDate"
            v-model="receiptDate"
            type="date"
          />
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            v-model="notes"
            placeholder="Add any additional notes..."
            rows="3"
          ></textarea>
        </div>
      </div>

      <p class="form-section-title">GR Lines</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Open QTY</th>
              <th>Receipt QTY *</th>
              <th>Site Code *</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, idx) in grLines" :key="line.poLineId">
              <td>{{ idx + 1 }}</td>
              <td>{{ line.itemCode }}</td>
              <td>{{ line.itemName }}</td>
              <td>{{ line.qtyOpenForGr }}</td>
              <td>
                <input
                  v-model.number="line.qtyReceived"
                  type="number"
                  min="0.01"
                  step="0.01"
                  :max="line.qtyOpenForGr"
                  class="input-quantity"
                />
              </td>
              <td>
                <input
                  v-model="line.actualSiteCode"
                  type="text"
                  placeholder="e.g., WH-01"
                  class="input-site"
                />
              </td>
              <td>
                <button
                  class="btn btn-sm btn-danger"
                  @click="removeLineFromGr(line.poLineId)"
                >
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="form-row form-row-right">
        <button
          class="btn btn-secondary"
          @click="cancelCreate"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="submitCreate"
          :disabled="submitting || !isFormValid"
        >
          {{ submitting ? 'Creating...' : 'Create GR' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const errorMessage = ref('');
const submitting = ref(false);
const loadingOpenLines = ref(false);

const purchaseOrders = ref([]);
const selectedPoId = ref('');
const purchaseOrder = ref(null);
const openLines = ref([]);
const grLines = ref([]);

const receiptDate = ref(new Date().toISOString().split('T')[0]);
const notes = ref('');

const isFormValid = computed(() => {
  return grLines.value.length > 0 && grLines.value.every(
    (line) => line.qtyReceived > 0 && line.actualSiteCode && line.actualSiteCode.trim()
  );
});

async function loadPurchaseOrders() {
  try {
    const data = await api.listPurchaseOrders();
    purchaseOrders.value = data.items
      .filter((po) => po.status === 'SUBMITTED')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    errorMessage.value = `Failed to load purchase orders: ${error.message}`;
  }
}

async function loadOpenLines() {
  if (!selectedPoId.value) {
    purchaseOrder.value = null;
    openLines.value = [];
    return;
  }

  errorMessage.value = '';
  loadingOpenLines.value = true;
  grLines.value = [];

  try {
    const data = await api.getOpenPoLinesForGr(selectedPoId.value);
    purchaseOrder.value = data.purchaseOrder;
    openLines.value = data.openLines || [];
  } catch (error) {
    errorMessage.value = `Failed to load open lines: ${error.message}`;
    purchaseOrder.value = null;
    openLines.value = [];
  } finally {
    loadingOpenLines.value = false;
  }
}

function addLineToGr(line) {
  grLines.value.push({
    poLineId: line.id,
    itemCode: line.itemCode,
    itemName: line.itemName,
    qtyOpenForGr: line.qtyOpenForGr,
    qtyReceived: line.qtyOpenForGr,
    actualSiteCode: line.siteCode || '',
  });
}

function removeLineFromGr(poLineId) {
  grLines.value = grLines.value.filter((line) => line.poLineId !== poLineId);
}

async function submitCreate() {
  if (!isFormValid.value) {
    errorMessage.value = 'Please fill in all required fields';
    return;
  }

  errorMessage.value = '';
  submitting.value = true;

  try {
    const payload = {
      poId: selectedPoId.value,
      lines: grLines.value.map((line) => ({
        poLineId: line.poLineId,
        qtyReceived: line.qtyReceived,
        actualSiteCode: line.actualSiteCode,
      })),
      receiptDate: receiptDate.value,
      notes: notes.value || null,
    };

    const newGr = await api.createGoodsReceipt(payload);
    await router.push(`/goods-receipts/${newGr.id}`);
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
  }
}

function cancelCreate() {
  router.back();
}

onMounted(loadPurchaseOrders);
</script>

<style scoped>
.form-section-title {
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--text);
}

.gr-header-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row-right {
  justify-content: flex-end;
  gap: 12px;
}

.info {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 4px;
  color: var(--text-muted);
}

.input-quantity,
.input-site {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}

.input-quantity:focus,
.input-site:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.table-scroll {
  overflow-x: auto;
}

table {
  min-width: 800px;
}

.status-badge {
  align-self: flex-start;
}
</style>
