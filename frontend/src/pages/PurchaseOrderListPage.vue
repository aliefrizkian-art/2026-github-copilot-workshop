<template>
  <section>
    <div class="page-header">
      <div class="page-header-left">
        <RouterLink to="/" class="back-btn" title="Back to Dashboard">&#8592;</RouterLink>
        <div>
          <h2>Purchase Orders</h2>
          <p class="muted">All purchase order records</p>
        </div>
      </div>
      <RouterLink class="btn btn-outline" to="/purchase-orders/new">+ New PO</RouterLink>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div class="card-panel table-scroll">
      <table>
        <thead>
          <tr>
            <th>PO Number</th>
            <th>Vendor</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0 && !errorMessage">
            <td colspan="4" class="empty-cell">No purchase orders found.</td>
          </tr>
          <tr v-for="item in items" :key="item.id">
            <td><RouterLink :to="`/purchase-orders/${item.id}`">{{ item.poNumber }}</RouterLink></td>
            <td>{{ item.vendorName }}</td>
            <td>
              <span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span>
            </td>
            <td>{{ formatDate(item.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';

const items = ref([]);
const errorMessage = ref('');

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

onMounted(async () => {
  try {
    const payload = await api.listPurchaseOrders();
    items.value = payload.items || [];
  } catch (error) {
    errorMessage.value = error.message;
  }
});
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
}

table {
  min-width: 640px;
}

.empty-cell {
  padding: 32px;
  color: var(--text-muted);
  text-align: center;
}
</style>