<script setup lang="ts">
// ==================== 类型定义 ====================
interface Process {
  id: string
  arrivalTime: number
  serviceTime: number
  finishTime?: number
  turnaroundTime?: number
  weightedTurnaroundTime?: number
}

// ==================== 响应式数据 ====================
import { ref, reactive, computed } from 'vue'

// 进程列表（用户输入的进程）
const processes = ref<Process[]>([])

// 当前输入的进程信息
const newProcess = reactive({
  id: '',
  arrivalTime: 0,
  serviceTime: 0
})

// 调度结果（甘特图 + 统计结果）
const scheduleResult = ref<any[]>([])
const statistics = ref<any[]>([])

// ==================== 方法 ====================

// 添加进程
function addProcess() {
  if (!newProcess.id || newProcess.serviceTime <= 0) {
    alert('请输入有效的进程ID和服务时间')
    return
  }

  processes.value.push({
    id: newProcess.id,
    arrivalTime: newProcess.arrivalTime,
    serviceTime: newProcess.serviceTime
  })

  // 清空输入框
  newProcess.id = ''
  newProcess.arrivalTime = 0
  newProcess.serviceTime = 0
}

// 删除进程
function removeProcess(index: number) {
  processes.value.splice(index, 1)
}

// 重置所有数据
function reset() {
  processes.value = []
  scheduleResult.value = []
  statistics.value = []
}

// ==================== FCFS 算法核心 ====================
function runFCFS() {
  if (processes.value.length === 0) {
    alert('请先添加进程')
    return
  }

  // 1. 按到达时间排序（FCFS核心）
  const sortedProcesses = [...processes.value].sort((a, b) => a.arrivalTime - b.arrivalTime)

  let currentTime = 0
  const results: any[] = []
  const gantt: any[] = []

  sortedProcesses.forEach((process) => {
    // 如果当前时间小于进程到达时间，需要等待
    if (currentTime < process.arrivalTime) {
      currentTime = process.arrivalTime
    }

    const startTime = currentTime
    const finishTime = currentTime + process.serviceTime

    // 计算各项时间
    const turnaroundTime = finishTime - process.arrivalTime
    const weightedTurnaroundTime = turnaroundTime / process.serviceTime

    // 记录结果
    results.push({
      ...process,
      startTime,
      finishTime,
      turnaroundTime: parseFloat(turnaroundTime.toFixed(2)),
      weightedTurnaroundTime: parseFloat(weightedTurnaroundTime.toFixed(2))
    })

    // 记录甘特图数据
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
</script>

<template>
  <div class="scheduling-module">
    <h2>模块1：处理器调度模拟（当前：FCFS）</h2>

    <!-- 进程输入区域 -->
    <div class="input-section">
      <h3>添加进程</h3>
      <div class="input-form">
        <input v-model="newProcess.id" placeholder="进程ID（如 P1）" />
        <input v-model.number="newProcess.arrivalTime" type="number" placeholder="到达时间" />
        <input v-model.number="newProcess.serviceTime" type="number" placeholder="服务时间" />
        <button @click="addProcess">添加进程</button>
      </div>
    </div>

    <!-- 进程列表 -->
    <div class="process-list">
      <h3>当前进程列表（共 {{ processes.length }} 个）</h3>
      <table v-if="processes.length > 0">
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

    <!-- 甘特图区域 -->
    <div v-if="scheduleResult.length > 0" class="gantt-section">
      <h3>调度甘特图</h3>
      <div class="gantt-chart">
        <div 
          v-for="item in scheduleResult" 
          :key="item.id"
          class="gantt-bar"
          :style="{ 
            width: item.duration * 40 + 'px',
            marginLeft: item.start * 40 + 'px' 
          }"
        >
          {{ item.id }} ({{ item.duration }})
        </div>
      </div>
      <p class="tip">横轴单位：时间（每格代表1个时间单位）</p>
    </div>

    <!-- 结果统计表格 -->
    <div v-if="statistics.length > 0" class="result-section">
      <h3>调度结果统计</h3>
      <table>
        <thead>
          <tr>
            <th>进程ID</th>
            <th>到达时间</th>
            <th>服务时间</th>
            <th>开始时间</th>
            <th>完成时间</th>
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
.input-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.input-form input {
  padding: 8px;
  width: 120px;
}
button {
  padding: 8px 16px;
  cursor: pointer;
}
.primary {
  background-color: #42b983;
  color: white;
  border: none;
}
.gantt-chart {
  display: flex;
  align-items: center;
  height: 40px;
  background: #f0f0f0;
  position: relative;
  margin: 20px 0;
  overflow-x: auto;
}
.gantt-bar {
  height: 30px;
  background: #42b983;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  white-space: nowrap;
  border-radius: 4px;
  position: absolute;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}
</style>