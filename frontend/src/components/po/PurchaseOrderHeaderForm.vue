<template>
  <section class="card-panel po-header-card">
    <h3>PO Header</h3>

    <div class="po-header-grid">
      <div class="form-group">
        <label for="po-vendor">Vendor</label>
        <input id="po-vendor" v-model="model.vendorName" placeholder="Type..." required />
      </div>

      <div class="form-group">
        <label for="po-source-pr">Approved PR</label>
        <select id="po-source-pr" v-model="model.sourcePrId" required>
          <option value="">Select</option>
          <option v-for="requisition in requisitions" :key="requisition.id" :value="requisition.id">
            {{ requisition.prNumber }} - {{ requisition.title }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="po-needed-by">Needed By date</label>
        <input id="po-needed-by" v-model="model.neededByDate" class="date-field" type="date" disabled />
      </div>

      <div class="form-group">
        <label for="po-currency">Currency</label>
        <input id="po-currency" v-model="model.currency" placeholder="IDR..." disabled />
      </div>

      <div class="form-group">
        <label for="po-payment-terms">Payment Terms</label>
        <input id="po-payment-terms" v-model="model.paymentTerms" placeholder="Type..." disabled />
      </div>
    </div>

    <div class="form-group">
      <label for="po-notes">Notes</label>
      <textarea id="po-notes" v-model="model.notes" placeholder="Type..." rows="3" disabled />
    </div>
  </section>
</template>

<script setup>
const model = defineModel({ required: true });

defineProps({
  requisitions: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped>
.po-header-card h3 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.po-header-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.po-header-card :deep(input),
.po-header-card :deep(textarea) {
  min-height: 45px;
  border-radius: 5px;
}

.po-header-card :deep(:disabled) {
  background-color: var(--table-header);
  color: var(--text-muted);
  cursor: not-allowed;
}

.date-field {
  background: var(--white) url('../../assets/po-create/calendar.svg') right 12px center / 18px 20px no-repeat;
  padding-right: 42px;
}

.date-field::-webkit-calendar-picker-indicator {
  opacity: 0;
  width: 24px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .po-header-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .po-header-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>