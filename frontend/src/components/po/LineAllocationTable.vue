<template>
  <section class="card-panel allocation-card">
    <div class="allocation-header">
      <h3>Approved PR Lines</h3>
      <button class="btn btn-refresh" type="button" :disabled="loading" @click="$emit('refresh')">
        {{ loading ? 'Refreshing...' : 'Refresh Open Lines' }}
      </button>
    </div>

    <div class="table-scroll">
      <table class="allocation-table">
        <thead>
          <tr>
            <th>Select</th>
            <th>PR No</th>
            <th>PR Line</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>UOM</th>
            <th>Requested QTY</th>
            <th>Allocated QTY</th>
            <th>Remaining QTY</th>
            <th>Order QTY</th>
            <th>Delivery Address</th>
            <th>Delivery Date</th>
            <th>Unit Price</th>
            <th>Line Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && lines.length === 0">
            <td class="empty-cell" colspan="14">Select an approved PR to view open lines.</td>
          </tr>
          <tr v-for="line in lines" :key="line.id">
            <td>
              <label class="checkbox-control">
                <input v-model="line.selected" type="checkbox" :aria-label="`Select ${line.itemCode}`" />
                <span aria-hidden="true" />
              </label>
            </td>
            <td>{{ line.prNumber }}</td>
            <td>{{ line.prLine }}</td>
            <td>{{ line.itemCode }}</td>
            <td>{{ line.itemName }}</td>
            <td>{{ line.uom }}</td>
            <td>{{ line.requestedQty }}</td>
            <td>{{ line.allocatedQty }}</td>
            <td>{{ line.remainingQty }}</td>
            <td>
              <input
                v-model.number="line.orderQty"
                class="cell-input quantity-input"
                :class="{ invalid: line.error }"
                :aria-label="`Order quantity for ${line.itemCode}`"
                :disabled="!line.selected"
                min="0.01"
                :max="line.remainingQty"
                step="0.01"
                type="number"
              />
              <span v-if="line.error" class="line-error">{{ line.error }}</span>
            </td>
            <td><input v-model="line.deliveryAddress" class="cell-input address-input" placeholder="Type..." disabled /></td>
            <td><input v-model="line.deliveryDate" class="cell-input date-input" type="date" disabled /></td>
            <td>
              <input
                v-model.number="line.unitPrice"
                class="cell-input price-input"
                :aria-label="`Unit price for ${line.itemCode}`"
                :disabled="!line.selected"
                min="0"
                step="0.01"
                type="number"
              />
            </td>
            <td>{{ formatAmount(line.orderQty * line.unitPrice) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
defineProps({
  lines: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['refresh']);

function formatAmount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}
</script>

<style scoped>
.allocation-card {
  padding-bottom: 16px;
}

.allocation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.allocation-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.btn-refresh {
  min-height: 45px;
  background: var(--white);
  color: var(--text);
  border: 1px solid var(--primary);
}

.table-scroll {
  overflow-x: auto;
}

.allocation-table {
  min-width: 1220px;
  table-layout: auto;
}

.allocation-table th {
  white-space: normal;
  line-height: 1.25;
}

.allocation-table td {
  white-space: nowrap;
}

.cell-input {
  height: 45px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font: inherit;
  color: var(--text);
  background: var(--white);
}

.cell-input:focus {
  border-color: var(--primary);
  outline: none;
}

.cell-input.invalid {
  border-color: #c62828;
}

.cell-input:disabled {
  background: var(--table-header);
  color: var(--text-muted);
}

.line-error {
  display: block;
  width: 110px;
  margin-top: 4px;
  color: #c62828;
  font-size: 11px;
  white-space: normal;
}

.empty-cell {
  height: 80px;
  color: var(--text-muted);
  text-align: center;
}

.quantity-input,
.price-input {
  width: 78px;
}

.address-input,
.date-input {
  width: 130px;
}

.date-input {
  background: var(--white) url('../../assets/po-create/calendar.svg') right 9px center / 18px 20px no-repeat;
  padding-right: 35px;
}

.date-input::-webkit-calendar-picker-indicator {
  opacity: 0;
  cursor: pointer;
}

.checkbox-control {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
}

.checkbox-control input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 16px;
  height: 16px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.checkbox-control span {
  display: block;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--white);
}

.checkbox-control input:checked + span {
  border-color: var(--primary);
  background: var(--primary) url('../../assets/po-create/check-small.svg') center / 10px 8px no-repeat;
}

.checkbox-control input:focus-visible + span {
  outline: 2px solid var(--primary-light);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .allocation-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>