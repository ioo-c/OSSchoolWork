<script setup lang="ts">
// ==================== 类型定义 ====================
interface Process {
  id: string
  arrivalTime: number
  serviceTime: number
  finishTime?: number
  turnaroundTime?: number
  waitingTime?: number
  weightedTurnaroundTime?: number
}

// ==================== 导入测试用例 ====================
import { schedulingTestCases } from '@/data/testCases'
import { ref, reactive, computed } from 'vue'

// ==================== 响应式数据 ====================
const processes = ref<Process[]>([])
const newProcess = reactive({
  id: '',
  arrivalTime: null as number | null,
  serviceTime: null as number | null
})

const scheduleResult = ref<any[]>([])
const statistics = ref<any[]>([])

// ==================== 加载测试用例 ====================
function loadTestCase(caseId: number) {
  const testCase = schedulingTestCases.find(c => c.id === caseId)
  if (testCase) {
    processes.value = JSON.parse(JSON.stringify(testCase.processes))
    scheduleResult.value = []
    statistics.value = []
  }
}

// ==================== 方法 ====================
function addProcess() {
  if (!newProcess.id || newProcess.serviceTime === null || newProcess.serviceTime <= 0 || newProcess.arrivalTime === null) {
    alert('请输入有效的进程ID、到达时间和服务时间')
    return
  }

  processes.value.push({
    id: newProcess.id,
    arrivalTime: newProcess.arrivalTime,
    serviceTime: newProcess.serviceTime
  })

  // 清空输入框
  newProcess.id = ''
  newProcess.arrivalTime = null
  newProcess.serviceTime = null
}

function removeProcess(index: number) {
  processes.value.splice(index, 1)
}

function reset() {
  processes.value = []
  scheduleResult.value = []
  statistics.value = []
}

// ==================== FCFS 算法 ====================
function runFCFS() {
  if (processes.value.length === 0) {
    alert('请先添加进程')
    return
  }

  // 按到达时间排序（FCFS核心）
  const sortedProcesses = [...processes.value].sort((a, b) => a.arrivalTime - b.arrivalTime)

  let currentTime = 0
  const results: any[] = []
  const gantt: any[] = []

  sortedProcesses.forEach((process) => {
    // 如果当前时间小于进程到达时间，则等待
    if (currentTime < process.arrivalTime) currentTime = process.arrivalTime

    const startTime = currentTime
    const finishTime = currentTime + process.serviceTime
    const turnaroundTime = finishTime - process.arrivalTime
    const waitingTime = startTime - process.arrivalTime
    const weightedTurnaroundTime = turnaroundTime / process.serviceTime

    results.push({
      ...process,
      startTime,
      finishTime,
      turnaroundTime: parseFloat(turnaroundTime.toFixed(2)),
      waitingTime: parseFloat(waitingTime.toFixed(2)),
      weightedTurnaroundTime: parseFloat(weightedTurnaroundTime.toFixed(2))
    })

    gantt.push({
      id: process.id,
      start: startTime,
      end: finishTime,
      duration: process.serviceTime
    })

    currentTime = finishTime
  })

  scheduleResult.value = gantt
  statistics.value = results
}

// ==================== 计算属性 ====================
const averageWaitingTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((sum, p) => sum + (p.waitingTime || 0), 0)
  return (total / statistics.value.length).toFixed(2)
})

const averageTurnaroundTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((sum, p) => sum + p.turnaroundTime, 0)
  return (total / statistics.value.length).toFixed(2)
})

const averageWeightedTurnaroundTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((sum, p) => sum + p.weightedTurnaroundTime, 0)
  return (total / statistics.value.length).toFixed(2)
})

const throughput = computed(() => {
  if (statistics.value.length === 0) return '0.0000'
  const lastFinishTime = Math.max(...statistics.value.map(p => p.finishTime))
  return (statistics.value.length / lastFinishTime).toFixed(4)
})
</script>

<template>
  <div class="scheduling-module">
    <h2>模块1：处理器调度模拟（当前：FCFS）</h2>

    <!-- 测试用例区域 -->
    <div class="test-cases">
      <h3>测试用例（统一数据）</h3>
      <div class="test-buttons">
        <button 
          v-for="test in schedulingTestCases" 
          :key="test.id" 
          @click="loadTestCase(test.id)"
          class="test-btn"
        >
          {{ test.name }}
        </button>
      </div>
    </div>

    <!-- 手动添加进程 -->
    <div class="input-section">
      <h3>添加进程（手动）</h3>
      <div class="input-form">
        <input v-model="newProcess.id" placeholder="进程ID（如 P1）" />
        <input v-model.number="newProcess.arrivalTime" type="number" placeholder="到达时间" />
        <input v-model.number="newProcess.serviceTime" type="number" placeholder="服务时间" />
        <button @click="addProcess">添加进程</button>
      </div>
    </div>

    <!-- 进程列表表格（已修复边框） -->
    <div class="process-list">
      <h3>当前进程列表（共 {{ processes.length }} 个）</h3>
      
      <!-- 这里加了 class="process-table" -->
      <table v-if="processes.length > 0" class="process-table">
        <thead>
          <tr>
            <th>进程ID</th>
            <th>到达时间</th>
            <th>服务时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, index) in processes" :key="index">
            <td>{{ p.id }}</td>
            <td>{{ p.arrivalTime }}</td>
            <td>{{ p.serviceTime }}</td>
            <td><button @click="removeProcess(index)">删除</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else>暂无进程，请添加</p>
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="runFCFS" class="primary">运行 FCFS 调度</button>
      <button @click="reset">重置</button>
    </div>

    <!-- 甘特图区域（保持不变） -->
    <div class="gantt-section">
      <h3>调度甘特图</h3>
      <div class="time-axis">
        <div v-for="n in 60" :key="n" class="time-tick">{{ n-1 }}T</div>
      </div>
      <div class="gantt-bars-wrapper">
        <div 
          v-for="item in scheduleResult" 
          :key="item.id"
          class="gantt-bar"
          :style="{ 
            marginLeft: item.start * 40 + 'px',
            width: item.duration * 40 + 'px' 
          }"
        >
          {{ item.id }} ({{ item.duration }})
        </div>
      </div>
    </div>

    <!-- 结果统计（已修复边框） -->
    <div v-if="statistics.length > 0" class="result-section">
      <h3>调度结果统计</h3>

      <div class="summary">
        <p><strong>平均等待时间：</strong> {{ averageWaitingTime }}</p>
        <p><strong>平均周转时间：</strong> {{ averageTurnaroundTime }}</p>
        <p><strong>平均带权周转时间：</strong> {{ averageWeightedTurnaroundTime }}</p>
        <p><strong>吞吐率：</strong> {{ throughput }} 进程/单位时间</p>
      </div>

      <table class="result-table">
        <thead>
          <tr>
            <th>进程ID</th>
            <th>到达时间</th>
            <th>服务时间</th>
            <th>开始时间</th>
            <th>完成时间</th>
            <th>等待时间</th>
            <th>周转时间</th>
            <th>带权周转时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in statistics" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ item.arrivalTime }}</td>
            <td>{{ item.serviceTime }}</td>
            <td>{{ item.startTime }}</td>
            <td>{{ item.finishTime }}</td>
            <td>{{ item.waitingTime }}</td>
            <td>{{ item.turnaroundTime }}</td>
            <td>{{ item.weightedTurnaroundTime }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.scheduling-module {
  padding: 20px;
}

/* ==================== 表格通用样式（重点！） ==================== */
/* 使用逗号分隔选择器，让 process-table 和 result-table 共用样式 */
/* border-collapse: collapse 是让边框合并成一条线，非常重要！ */
.process-table,
.result-table {
  width: 100%;
  border-collapse: collapse;   /* 关键属性：边框合并 */
  margin-top: 10px;
  background: white;
  border: 1px solid #999;      /* 表格外边框 */
}

/* 表头和单元格都要设置边框 */
.process-table th,
.process-table td,
.result-table th,
.result-table td {
  border: 1px solid #999;      /* 单元格边框 */
  padding: 8px 10px;
  text-align: center;
  font-size: 14px;
}

/* 表头样式 */
.process-table th,
.result-table th {
  background-color: #f0f0f0;
  font-weight: 600;
  color: #333;
}

/* 鼠标悬停高亮 */
.process-table tr:hover,
.result-table tr:hover {
  background-color: #f9f9f9;
}

/* ==================== 其他样式保持不变 ==================== */
.test-cases { margin-bottom: 20px; }
.test-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
.test-btn { padding: 6px 14px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.test-btn:hover { background-color: #5a6268; }

.input-form { display: flex; gap: 10px; margin-bottom: 20px; }
.input-form input { padding: 8px; width: 120px; }

button { padding: 8px 16px; cursor: pointer; }
.primary { background-color: #42b983; color: white; border: none; }

.gantt-section { margin: 25px 0; }
.time-axis { display: flex; border-bottom: 2px solid #666; margin-bottom: 4px; }
.time-tick { width: 40px; flex-shrink: 0; text-align: center; font-size: 11px; color: #555; padding-bottom: 4px; position: relative; box-sizing: border-box; }
.time-tick::after { content: ''; position: absolute; left: 0; top: 100%; width: 1px; height: 110px; border-left: 1px dashed #aaa; z-index: 1; }

.gantt-bars-wrapper { position: relative; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 12px 0 8px; overflow-x: auto; min-height: 70px; }
.gantt-bar { height: 34px; background: #42b983; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; white-space: nowrap; border-radius: 5px; margin-bottom: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15); position: relative; z-index: 2; }
</style>