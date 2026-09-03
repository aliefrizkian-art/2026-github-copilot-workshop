<template>
  <div class="layout">
    <header class="navbar">
      <span class="navbar-brand">Procurement MVP</span>
      <nav>
        <RouterLink to="/" :class="{ active: isDashboard }">Dashboard</RouterLink>
        <RouterLink to="/requisitions" :class="{ active: isRequisitions }">Purchase Requisitions</RouterLink>
        <RouterLink to="/purchase-orders" :class="{ active: isPurchaseOrders }">Purchase Orders</RouterLink>
      </nav>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

const route = useRoute();
const isDashboard = computed(() => route.path === '/');
const isRequisitions = computed(() => route.path.startsWith('/requisitions'));
const isPurchaseOrders = computed(() => route.path.startsWith('/purchase-orders'));
</script>
