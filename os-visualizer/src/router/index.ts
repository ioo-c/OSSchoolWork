// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'

// 导入我们后面要用的页面组件（先占位，后面再创建真实文件）
import SchedulingView from '../views/SchedulingView.vue'
import ProducerConsumerView from '../views/ProducerConsumerView.vue'
import BankerView from '../views/BankerView.vue'
import PageReplacementView from '../views/PageReplacementView.vue'
import DiskSchedulingView from '../views/DiskSchedulingView.vue'

// 定义路由规则
const routes = [
  {
    path: '/',                    // 访问根路径时，默认显示处理器调度模块
    name: 'Home',
    component: SchedulingView
  },
  {
    path: '/scheduling',          // 模块1：处理器调度
    name: 'Scheduling',
    component: SchedulingView
  },
  {
    path: '/producer-consumer',   // 模块2：生产者-消费者
    name: 'ProducerConsumer',
    component: ProducerConsumerView
  },
  {
    path: '/banker',              // 模块3：银行家算法
    name: 'Banker',
    component: BankerView
  },
  {
    path: '/page-replacement',    // 模块4：页面置换
    name: 'PageReplacement',
    component: PageReplacementView
  },
  {
    path: '/disk-scheduling',     // 模块5：磁盘调度
    name: 'DiskScheduling',
    component: DiskSchedulingView
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),   // 使用 HTML5 History 模式（URL 干净，没有 #）
  routes                         // 上面定义的路由规则
})

export default router