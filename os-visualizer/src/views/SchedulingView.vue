<script setup lang="ts">
// ==================== 类型定义 ====================
interface Process {
  id: string
  arrivalTime: number
  serviceTime: number
  finishTime?: number
}

interface RRProcess extends Process {
  remainingTime: number
}

interface GanttItem {
  id: string
  start: number
  end: number
  duration: number
}

interface StatItem {
  id: string
  arrivalTime: number
  serviceTime: number
  startTime: number
  finishTime: number
  turnaroundTime: number
  waitingTime: number
  weightedTurnaroundTime: number
}

// ==================== 导入 ====================
import { schedulingTestCases } from '@/data/testCases'
import { ref, reactive, computed } from 'vue'

// ==================== 算法类型 ====================
type AlgorithmType = 'FCFS' | 'RR' | 'SJF' | 'HRN'
const algorithmLabels: Record<AlgorithmType, string> = {
  'FCFS': '先来先服务（FCFS）',
  'RR': '时间片轮转（RR）',
  'SJF': '短进程优先（SJF 抢占）',
  'HRN': '最高响应比优先（HRN）'
}
const allAlgorithms: AlgorithmType[] = ['FCFS', 'RR', 'SJF', 'HRN']

// ==================== 响应式数据 ====================
const processes = ref<Process[]>([])
const newProcess = reactive({
  id: '',
  arrivalTime: null as number | null,
  serviceTime: null as number | null
})

const selectedAlgorithm = ref<AlgorithmType>('FCFS')
const timeQuantum = ref(2)
const scheduleResult = ref<GanttItem[]>([])
const statistics = ref<StatItem[]>([])

// ==================== 辅助函数 ====================
function computeStatistics(finished: Process[]): StatItem[] {
  return finished.map(p => {
    const ft = p.finishTime ?? 0
    const tt = ft - p.arrivalTime
    const wt = tt - p.serviceTime
    return {
      id: p.id,
      arrivalTime: p.arrivalTime,
      serviceTime: p.serviceTime,
      startTime: ft - p.serviceTime,
      finishTime: ft,
      turnaroundTime: parseFloat(tt.toFixed(2)),
      waitingTime: parseFloat(wt.toFixed(2)),
      weightedTurnaroundTime: parseFloat((tt / p.serviceTime).toFixed(2))
    }
  })
}

// ==================== 进程管理 ====================
function loadTestCase(caseId: number) {
  const testCase = schedulingTestCases.find(c => c.id === caseId)
  if (testCase) {
    processes.value = JSON.parse(JSON.stringify(testCase.processes))
    scheduleResult.value = []
    statistics.value = []
  }
}

function addProcess() {
  if (!newProcess.id || newProcess.serviceTime === null || newProcess.serviceTime <= 0 || newProcess.arrivalTime === null) {
    alert('请输入有效的进程ID、到达时间和服务时间')
    return
  }
  if (processes.value.some(p => p.id === newProcess.id)) {
    alert('进程ID已存在，请使用不同的ID')
    return
  }
  processes.value.push({
    id: newProcess.id,
    arrivalTime: newProcess.arrivalTime,
    serviceTime: newProcess.serviceTime
  })
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

// ==================== 运行调度入口 ====================
function runSchedule() {
  if (processes.value.length === 0) {
    alert('请先添加进程')
    return
  }
  switch (selectedAlgorithm.value) {
    case 'FCFS': runFCFS(); break
    case 'RR': runRR(); break
    case 'SJF': runSJF(); break
    case 'HRN': runHRN(); break
  }
}

// ==================== FCFS 先来先服务 ====================
function runFCFS() {
  const sorted = [...processes.value].sort((a, b) => a.arrivalTime - b.arrivalTime)
  let now = 0
  const finished: Process[] = []
  const gantt: GanttItem[] = []

  for (const p of sorted) {
    if (now < p.arrivalTime) now = p.arrivalTime
    const start = now
    now += p.serviceTime
    gantt.push({ id: p.id, start, end: now, duration: p.serviceTime })
    finished.push({ ...p, finishTime: now })
  }

  statistics.value = computeStatistics(finished)
  scheduleResult.value = gantt
}

// ==================== RR 时间片轮转 ====================
function runRR() {
  const q = timeQuantum.value
  if (q <= 0) { alert('时间片必须大于 0'); return }

  const remain: RRProcess[] = processes.value.map(p => ({ ...p, remainingTime: p.serviceTime }))
  // 已到达与未到达分组
  let notYet = remain.filter(p => p.arrivalTime > 0).sort((a, b) => a.arrivalTime - b.arrivalTime)
  const ready: RRProcess[] = remain.filter(p => p.arrivalTime === 0)

  let now = 0
  const gantt: GanttItem[] = []
  const finished: Process[] = []

  const enqueueArrived = () => {
    while (notYet.length > 0 && notYet[0]!.arrivalTime <= now) {
      ready.push(notYet.shift()!)
    }
  }
  enqueueArrived()

  while (finished.length < remain.length) {
    if (ready.length === 0) {
      if (notYet.length > 0) {
        now = notYet[0]!.arrivalTime
        enqueueArrived()
        continue
      }
      break
    }

    const cur = ready.shift()
    if (!cur) break
    const slice = Math.min(cur.remainingTime, q)
    const start = now
    now += slice
    cur.remainingTime -= slice

    // 甘特图：合并连续同进程
    const lastGantt = gantt.length > 0 ? gantt[gantt.length - 1] : null
    if (lastGantt && lastGantt.id === cur.id) {
      lastGantt.end = now
      lastGantt.duration += slice
    } else {
      gantt.push({ id: cur.id, start, end: now, duration: slice })
    }

    enqueueArrived()

    if (cur.remainingTime > 0) {
      ready.push(cur)
    } else {
      finished.push({ id: cur.id, arrivalTime: cur.arrivalTime, serviceTime: cur.serviceTime, finishTime: now })
    }
  }

  statistics.value = computeStatistics(finished)
  scheduleResult.value = gantt
}

// ==================== SJF 抢占式（SRTF 最短剩余时间优先） ====================
function runSJF() {
  const remain: RRProcess[] = processes.value.map(p => ({ ...p, remainingTime: p.serviceTime }))
  const totalService = remain.reduce((s, p) => s + p.serviceTime, 0)
  const maxArrival = Math.max(...remain.map(p => p.arrivalTime))
  const maxTime = maxArrival + totalService + 10

  const gantt: GanttItem[] = []
  const finished: Process[] = []

  for (let now = 0; now < maxTime; now++) {
    if (finished.length >= remain.length) break

    const arrived = remain.filter(
      p => p.arrivalTime <= now && p.remainingTime > 0 && !finished.some(f => f.id === p.id)
    )
    if (arrived.length === 0) continue

    // 选剩余时间最短的，相同则按到达时间早的
    arrived.sort((a, b) => {
      if (a.remainingTime !== b.remainingTime) return a.remainingTime - b.remainingTime
      return a.arrivalTime - b.arrivalTime
    })
    const cur = arrived[0] as RRProcess

    cur.remainingTime--

    const lastGantt = gantt.length > 0 ? gantt[gantt.length - 1] : null
    if (lastGantt && lastGantt.id === cur.id) {
      lastGantt.end = now + 1
      lastGantt.duration++
    } else {
      gantt.push({ id: cur.id, start: now, end: now + 1, duration: 1 })
    }

    if (cur.remainingTime === 0) {
      finished.push({ id: cur.id, arrivalTime: cur.arrivalTime, serviceTime: cur.serviceTime, finishTime: now + 1 })
    }
  }

  statistics.value = computeStatistics(finished)
  scheduleResult.value = gantt
}

// ==================== HRN 最高响应比优先 ====================
function runHRN() {
  const pool = [...processes.value]
  const finished: Process[] = []
  const gantt: GanttItem[] = []
  let now = 0

  while (finished.length < pool.length) {
    const arrived = pool.filter(p => p.arrivalTime <= now && !finished.some(f => f.id === p.id))

    if (arrived.length === 0) {
      const notArrived = pool.filter(p => !finished.some(f => f.id === p.id))
      if (notArrived.length > 0) {
        now = Math.min(...notArrived.map(p => p.arrivalTime))
        continue
      }
      break
    }

    // 响应比 = (等待时间 + 服务时间) / 服务时间 = 1 + 等待时间/服务时间
    let best: Process | null = null
    let bestRatio = -1
    for (const p of arrived) {
      const wait = now - p.arrivalTime
      const ratio = (wait + p.serviceTime) / p.serviceTime
      if (ratio > bestRatio || (ratio === bestRatio && best && p.arrivalTime < best.arrivalTime)) {
        bestRatio = ratio
        best = p
      }
    }

    if (!best) break

    const start = now
    now += best.serviceTime
    gantt.push({ id: best.id, start, end: now, duration: best.serviceTime })
    finished.push({ ...best, finishTime: now })
  }

  statistics.value = computeStatistics(finished)
  scheduleResult.value = gantt
}

// ==================== 计算属性 ====================
const averageWaitingTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((s, p) => s + p.waitingTime, 0)
  return (total / statistics.value.length).toFixed(2)
})

const averageTurnaroundTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((s, p) => s + p.turnaroundTime, 0)
  return (total / statistics.value.length).toFixed(2)
})

const averageWeightedTurnaroundTime = computed(() => {
  if (statistics.value.length === 0) return '0.00'
  const total = statistics.value.reduce((s, p) => s + p.weightedTurnaroundTime, 0)
  return (total / statistics.value.length).toFixed(2)
})

const throughput = computed(() => {
  if (statistics.value.length === 0) return '0.0000'
  const lastTime = Math.max(...statistics.value.map(p => p.finishTime))
  return (statistics.value.length / lastTime).toFixed(4)
})

// 甘特图：动态时间刻度数量
const timeTickCount = computed(() => {
  if (scheduleResult.value.length === 0) return 60
  const maxEnd = Math.max(...scheduleResult.value.map(g => g.end))
  return Math.max(maxEnd + 5, 20)
})

// 甘特图：动态虚线高度 = 甘特条数 × 每条约42px + 上下padding
const dashHeight = computed(() => {
  if (scheduleResult.value.length === 0) return 110
  return scheduleResult.value.length * 42 + 20
})
</script>

<template>
  <div class="scheduling-module">
    <h2>模块1：处理器调度模拟 — {{ algorithmLabels[selectedAlgorithm] }}</h2>

    <!-- 算法选择区 -->
    <div class="algorithm-selector">
      <h3>调度算法切换</h3>
      <div class="algo-buttons">
        <button
          v-for="algo in allAlgorithms"
          :key="algo"
          :class="['algo-btn', { active: selectedAlgorithm === algo }]"
          @click="selectedAlgorithm = algo; scheduleResult = []; statistics = []"
        >
          {{ algorithmLabels[algo] }}
        </button>
      </div>
      <div v-if="selectedAlgorithm === 'RR'" class="quantum-setting">
        <label>时间片大小：</label>
        <input v-model.number="timeQuantum" type="number" min="1" max="20" class="quantum-input" />
        <span class="quantum-hint">（默认 2 单位时间）</span>
      </div>
    </div>

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
        <input v-model.number="newProcess.arrivalTime" type="number" placeholder="到达时间" min="0" />
        <input v-model.number="newProcess.serviceTime" type="number" placeholder="服务时间" min="1" />
        <button @click="addProcess">添加进程</button>
      </div>
    </div>

    <!-- 进程列表 -->
    <div class="process-list">
      <h3>当前进程列表（共 {{ processes.length }} 个）</h3>
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
      <button @click="runSchedule" class="primary">运行 {{ algorithmLabels[selectedAlgorithm] }} 调度</button>
      <button @click="reset">重置</button>
    </div>

    <!-- 甘特图 -->
    <div class="gantt-section" v-if="scheduleResult.length > 0">
      <h3>调度甘特图</h3>
      <div class="time-axis">
        <div v-for="n in timeTickCount" :key="n" class="time-tick">
          {{ n - 1 }}T
          <span class="time-dash" :style="{ height: dashHeight + 'px' }"></span>
        </div>
      </div>
      <div class="gantt-bars-wrapper">
        <div
          v-for="(item, idx) in scheduleResult"
          :key="item.id + '-' + idx"
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

    <!-- 结果统计 -->
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

/* ==================== 算法切换区域 ==================== */
.algorithm-selector {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f0f7ff;
  border-radius: 8px;
  border: 1px solid #b3d4ff;
}

.algo-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.algo-btn {
  padding: 10px 20px;
  border: 2px solid #42b983;
  background: white;
  color: #42b983;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.algo-btn:hover {
  background: #e0f5ed;
}

.algo-btn.active {
  background: #42b983;
  color: white;
  box-shadow: 0 2px 8px rgba(66, 185, 131, 0.4);
}

.quantum-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 500;
}

.quantum-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-align: center;
}

.quantum-hint {
  color: #888;
  font-size: 12px;
}

/* ==================== 表格通用样式 ==================== */
.process-table,
.result-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  background: white;
  border: 1px solid #999;
}

.process-table th,
.process-table td,
.result-table th,
.result-table td {
  border: 1px solid #999;
  padding: 8px 10px;
  text-align: center;
  font-size: 14px;
}

.process-table th,
.result-table th {
  background-color: #f0f0f0;
  font-weight: 600;
  color: #333;
}

.process-table tr:hover,
.result-table tr:hover {
  background-color: #f9f9f9;
}

/* ==================== 通用样式 ==================== */
.test-cases { margin-bottom: 20px; }
.test-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
.test-btn { padding: 6px 14px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.test-btn:hover { background-color: #5a6268; }

.input-form { display: flex; gap: 10px; margin-bottom: 20px; }
.input-form input { padding: 8px; width: 120px; border: 1px solid #ccc; border-radius: 4px; }

button { padding: 8px 16px; cursor: pointer; border-radius: 4px; }
.primary { background-color: #42b983; color: white; border: none; font-weight: 600; }
.primary:hover { background-color: #38a472; }

.summary {
  background: #fafafa;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
}
.summary p { margin: 4px 0; font-size: 14px; }

.gantt-section { margin: 25px 0; }
.time-axis { display: flex; border-bottom: 2px solid #666; margin-bottom: 4px; }
.time-tick {
  width: 40px; flex-shrink: 0; text-align: center; font-size: 11px; color: #555;
  padding-bottom: 4px; position: relative; box-sizing: border-box;
}

.time-dash {
  position: absolute;
  left: 0;
  top: 100%;
  width: 1px;
  border-left: 1px dashed #aaa;
  z-index: 1;
  pointer-events: none;
}

.gantt-bars-wrapper { position: relative; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 12px 0 8px; overflow-x: auto; min-height: 70px; }
.gantt-bar { height: 34px; background: #42b983; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; white-space: nowrap; border-radius: 5px; margin-bottom: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15); position: relative; z-index: 2; }
</style>