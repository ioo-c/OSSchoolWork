<script setup>
// 这里暂时不用写逻辑
</script>

<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <header class="header">
      <h1>操作系统算法可视化系统</h1>
      <nav>
        <!-- router-link 用来做页面跳转，不会刷新页面 -->
        <router-link to="/scheduling">处理器调度</router-link>
        <router-link to="/producer-consumer">生产者-消费者</router-link>
        <router-link to="/banker">银行家算法</router-link>
        <router-link to="/page-replacement">页面置换</router-link>
        <router-link to="/disk-scheduling">磁盘调度</router-link>
      </nav>
    </header>

    <!-- 路由出口：点击上面链接后，对应的页面会在这里显示 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
/* 简单样式，先让页面能看，后面再美化 */
.header {
  background-color: #2c3e50;
  color: white;
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

nav a {
  color: white;
  margin-left: 20px;
  text-decoration: none;
}

nav a.router-link-active {
  color: #42b983;
  font-weight: bold;
}

.main-content {
  padding: 20px;
}
</style>