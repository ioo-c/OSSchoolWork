<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

// ==================== 类型定义 ====================
type Triple = [number, number, number] // [A, B, C]

interface ProcessInfo {
  id: string
  allocation: Triple
  max: Triple
  need: Triple
}

interface SafetyStep {
  processId: string
  need: Triple
  work: Triple
  finished: boolean
}

interface RequestResult {
  success: boolean
  message: string
  safeSequence?: string[]
  steps?: SafetyStep[]
}

// ==================== 资源名称 ====================
const resources = ['A', 'B', 'C'] as const

// ==================== 响应式数据 ====================
const totalResources = reactive<Triple>([10, 5, 7])
const processes = ref<ProcessInfo[]>([])
const safetySequence = ref<string[]>([])
const safetySteps = ref<SafetyStep[]>([])
const isSafe = ref<boolean | null>(null)

const newProcessForm = reactive({
  id: '',
  maxA: 0,
  maxB: 0,
  maxC: 0,
  allocationA: 0,
  allocationB: 0,
  allocationC: 0
})

const requestForm = reactive({
  processId: '',
  requestA: 0,
  requestB: 0,
  requestC: 0
})

const requestResult = ref<RequestResult | null>(null)

// 预设进程
const presets = [
  {
    name: '经典案例 T0-T4',
    total: [10, 5, 7] as Triple,
    processes: [
      { id: 'P0', alloc: [0, 1, 0] as Triple, max: [7, 5, 3] as Triple },
      { id: 'P1', alloc: [2, 0, 0] as Triple, max: [3, 2, 2] as Triple },
      { id: 'P2', alloc: [3, 0, 2] as Triple, max: [9, 0, 2] as Triple },
      { id: 'P3', alloc: [2, 1, 1] as Triple, max: [4, 2, 2] as Triple },
      { id: 'P4', alloc: [0, 0, 2] as Triple, max: [5, 3, 3] as Triple }
    ]
  },
  {
    name: '不安全案例',
    total: [3, 3, 2] as Triple,
    processes: [
      { id: 'P0', alloc: [0, 1, 0] as Triple, max: [7, 5, 3] as Triple },
      { id: 'P1', alloc: [2, 0, 0] as Triple, max: [3, 2, 2] as Triple },
      { id: 'P2', alloc: [3, 0, 2] as Triple, max: [9, 0, 2] as Triple }
    ]
  },
  {
    name: '简单安全案例',
    total: [3, 3, 2] as Triple,
    processes: [
      { id: 'P0', alloc: [0, 1, 0] as Triple, max: [2, 3, 2] as Triple },
      { id: 'P1', alloc: [1, 0, 0] as Triple, max: [3, 2, 2] as Triple },
      { id: 'P2', alloc: [2, 0, 1] as Triple, max: [9, 0, 2] as Triple }
    ]
  }
]

// ==================== 计算属性 ====================
const available = computed<Triple>(() => {
  let totalAlloc: Triple = [0, 0, 0]
  processes.value.forEach(p => {
    totalAlloc[0] += p.allocation[0]
    totalAlloc[1] += p.allocation[1]
    totalAlloc[2] += p.allocation[2]
  })
  return [
    totalResources[0] - totalAlloc[0],
    totalResources[1] - totalAlloc[1],
    totalResources[2] - totalAlloc[2]
  ]
})

// ==================== 加载预设 ====================
function loadPreset(index: number) {
  const preset = presets[index]
  if (!preset) return
  totalResources[0] = preset.total[0]
  totalResources[1] = preset.total[1]
  totalResources[2] = preset.total[2]
  processes.value = preset.processes.map(p => ({
    id: p.id,
    allocation: [...p.alloc] as Triple,
    max: [...p.max] as Triple,
    need: [p.max[0] - p.alloc[0], p.max[1] - p.alloc[1], p.max[2] - p.alloc[2]] as Triple
  }))
  clearResults()
}

// ==================== 进程管理 ====================
function addProcess() {
  const { id, maxA, maxB, maxC, allocationA, allocationB, allocationC } = newProcessForm
  if (!id) { alert('请输入进程ID'); return }
  if (processes.value.some(p => p.id === id)) { alert('进程ID已存在'); return }

  const allocation: Triple = [allocationA, allocationB, allocationC]
  const max: Triple = [maxA, maxB, maxC]
  const need: Triple = [max[0] - allocation[0], max[1] - allocation[1], max[2] - allocation[2]]

  if (need.some(n => n < 0)) { alert('最大需求不能小于已分配'); return }

  processes.value.push({ id, allocation, max, need })
  clearResults()
}

function removeProcess(index: number) {
  processes.value.splice(index, 1)
  clearResults()
}

function clearResults() {
  safetySequence.value = []
  safetySteps.value = []
  isSafe.value = null
  requestResult.value = null
}

// ==================== 银行家算法 - 安全性检查 ====================
function checkSafety(): boolean {
  const n = processes.value.length
  const work: Triple = [...available.value]
  const finish = new Array(n).fill(false)
  const seq: string[] = []
  const steps: SafetyStep[] = []

  const procs = processes.value.map(p => ({
    id: p.id,
    need: [...p.need] as Triple
  }))

  let count = 0
  while (count < n) {
    let found = false
    for (let i = 0; i < n; i++) {
      if (!finish[i]) {
        const procI = procs[i]
        const infoI = processes.value[i]
        if (!procI || !infoI) continue
        const need = procI.need
        const alloc = infoI.allocation
        if (need[0] <= work[0] && need[1] <= work[1] && need[2] <= work[2]) {
          const workBefore: Triple = [...work]
          work[0] += alloc[0]
          work[1] += alloc[1]
          work[2] += alloc[2]
          finish[i] = true
          seq.push(procI.id)
          steps.push({
            processId: procI.id,
            need: [...need] as Triple,
            work: [...workBefore] as Triple,
            finished: true
          })
          found = true
          count++
          break
        }
      }
    }
    if (!found) break
  }

  isSafe.value = finish.every(Boolean)
  safetySequence.value = seq
  safetySteps.value = steps
  return isSafe.value
}

function runSafetyCheck() {
  if (processes.value.length === 0) { alert('请先添加进程'); return }
  checkSafety()
}

// ==================== 资源请求 ====================
function requestResources() {
  if (processes.value.length === 0) { alert('请先添加进程'); return }

  const { processId, requestA, requestB, requestC } = requestForm
  if (!processId) { alert('请选择进程'); return }

  const request: Triple = [requestA, requestB, requestC]
  if (request.every(v => v === 0)) { alert('请至少请求一项资源'); return }

  const process = processes.value.find(p => p.id === processId)
  if (!process) { alert('进程不存在'); return }

  // 1. Request <= Need
  if (request[0] > process.need[0] || request[1] > process.need[1] || request[2] > process.need[2]) {
    requestResult.value = {
      success: false,
      message: `请求失败：${processId} 请求的资源超过了其最大需求 Need = [${process.need.join(', ')}]`
    }
    return
  }

  // 2. Request <= Available
  const avail = available.value
  if (request[0] > avail[0] || request[1] > avail[1] || request[2] > avail[2]) {
    requestResult.value = {
      success: false,
      message: `请求失败：系统当前可用资源 Available = [${avail.join(', ')}] 不足`
    }
    return
  }

  // 3. 试探性分配
  process.allocation[0] += request[0]
  process.allocation[1] += request[1]
  process.allocation[2] += request[2]
  process.need[0] -= request[0]
  process.need[1] -= request[1]
  process.need[2] -= request[2]

  // 4. 执行安全性检查
  const safe = checkSafety()

  if (safe) {
    requestResult.value = {
      success: true,
      message: `请求成功：分配 [${request.join(', ')}] 给 ${processId} 后系统仍安全`,
      safeSequence: [...safetySequence.value],
      steps: [...safetySteps.value]
    }
  } else {
    // 回滚
    process.allocation[0] -= request[0]
    process.allocation[1] -= request[1]
    process.allocation[2] -= request[2]
    process.need[0] += request[0]
    process.need[1] += request[1]
    process.need[2] += request[2]

    requestResult.value = {
      success: false,
      message: `请求失败：分配 [${request.join(', ')}] 给 ${processId} 后系统进入不安全状态，已回滚`
    }
  }
}

function resetRequest() {
  requestForm.processId = ''
  requestForm.requestA = 0
  requestForm.requestB = 0
  requestForm.requestC = 0
  requestResult.value = null
  // 恢复原始 need
  processes.value.forEach(p => {
    p.need[0] = p.max[0] - p.allocation[0]
    p.need[1] = p.max[1] - p.allocation[1]
    p.need[2] = p.max[2] - p.allocation[2]
  })
  checkSafety()
}

// ==================== 帮助函数 ====================
function getProcessById(id: string): ProcessInfo | undefined {
  return processes.value.find(p => p.id === id)
}

function formatTriple(t: Triple): string {
  return `[${t.join(', ')}]`
}

/** 安全访问 Triple 的第 i 个元素（0/1/2），模板中用 */
function itemAt(t: Triple, i: number): number {
  return t[i] ?? 0
}

function computeWorkAfter(workBefore: Triple, processId: string): Triple {
  const p = getProcessById(processId)
  if (!p) return workBefore
  return [
    workBefore[0] + p.allocation[0],
    workBefore[1] + p.allocation[1],
    workBefore[2] + p.allocation[2]
  ]
}
</script>

<template>
  <div class="banker-module">
    <h2>模块3：银行家算法演示</h2>

    <!-- 预设案例 -->
    <div class="preset-section">
      <h3>📂 预设案例</h3>
      <div class="preset-buttons">
        <button v-for="(preset, i) in presets" :key="i" @click="loadPreset(i)" class="preset-btn">
          {{ preset.name }}
        </button>
      </div>
    </div>

    <!-- 系统资源配置 -->
    <div class="config-panel">
      <h3>⚙ 系统总资源</h3>
      <div class="resource-inputs">
        <div v-for="r in resources" :key="r" class="resource-item">
          <label>资源 {{ r }}</label>
          <input v-model.number="totalResources[resources.indexOf(r)]" type="number" min="0" @change="clearResults" />
        </div>
      </div>
      <div class="available-display">
        <strong>当前可用资源 Available：</strong>
        [<span v-for="(v, i) in available" :key="i">{{ v }}<span v-if="i < 2">, </span></span>]
      </div>
    </div>

    <!-- 进程列表表格 -->
    <div class="table-panel">
      <h3>📊 进程资源状态</h3>
      <table v-if="processes.length > 0" class="data-table">
        <thead>
          <tr>
            <th>进程</th>
            <th colspan="3">已分配 Allocation</th>
            <th colspan="3">最大需求 Max</th>
            <th colspan="3">还需 Need</th>
            <th>操作</th>
          </tr>
          <tr>
            <th></th>
            <th>A</th><th>B</th><th>C</th>
            <th>A</th><th>B</th><th>C</th>
            <th>A</th><th>B</th><th>C</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, index) in processes" :key="p.id">
            <td class="proc-id">{{ p.id }}</td>
            <td v-for="j in 3" :key="'a'+j">{{ itemAt(p.allocation, j - 1) }}</td>
            <td v-for="j in 3" :key="'m'+j">{{ itemAt(p.max, j - 1) }}</td>
            <td v-for="j in 3" :key="'n'+j" :class="{ highlight: itemAt(p.need, j - 1) > 0 }">{{ itemAt(p.need, j - 1) }}</td>
            <td><button @click="removeProcess(index)" class="btn-del">删除</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else>暂无进程，请添加或加载预设案例</p>
    </div>

    <!-- 添加进程 -->
    <div class="add-panel">
      <h3>➕ 添加进程</h3>
      <div class="add-form">
        <input v-model="newProcessForm.id" placeholder="进程ID (如 P4)" class="id-input" />
        <div class="form-col">
          <label>Max</label>
          <div class="form-row">
            <input v-model.number="newProcessForm.maxA" type="number" min="0" placeholder="A" />
            <input v-model.number="newProcessForm.maxB" type="number" min="0" placeholder="B" />
            <input v-model.number="newProcessForm.maxC" type="number" min="0" placeholder="C" />
          </div>
        </div>
        <div class="form-col">
          <label>Allocation</label>
          <div class="form-row">
            <input v-model.number="newProcessForm.allocationA" type="number" min="0" placeholder="A" />
            <input v-model.number="newProcessForm.allocationB" type="number" min="0" placeholder="B" />
            <input v-model.number="newProcessForm.allocationC" type="number" min="0" placeholder="C" />
          </div>
        </div>
        <button @click="addProcess" class="btn-add">添加</button>
      </div>
    </div>

    <!-- 安全性检查 -->
    <div class="action-panel">
      <button @click="runSafetyCheck" class="btn-check">🔍 执行安全性检查</button>
      <button @click="clearResults" class="btn-reset">清空结果</button>
    </div>

    <!-- 安全序列展示 -->
    <div v-if="isSafe !== null" class="result-panel">
      <h3>
        {{ isSafe ? '✅ 系统处于安全状态' : '❌ 系统处于不安全状态' }}
      </h3>
      <div v-if="isSafe && safetySequence.length > 0" class="safe-sequence">
        <h4>安全序列：</h4>
        <div class="sequence-steps">
          <span v-for="(pid, idx) in safetySequence" :key="idx" class="seq-step">
            {{ pid }}
            <span v-if="idx < safetySequence.length - 1" class="seq-arrow">→</span>
          </span>
        </div>
      </div>

      <!-- 安全检查步骤 -->
      <div v-if="safetySteps.length > 0" class="safety-steps">
        <h4>执行步骤：</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>步骤</th>
              <th>进程</th>
              <th>Need</th>
              <th>进前 Work</th>
              <th>进后 Work</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(step, i) in safetySteps" :key="i">
              <td>{{ i + 1 }}</td>
              <td class="proc-id">{{ step.processId }}</td>
              <td>{{ formatTriple(step.need) }}</td>
              <td>{{ formatTriple(step.work) }}</td>
              <td>{{ formatTriple(computeWorkAfter(step.work, step.processId)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 资源请求 -->
    <div class="request-panel">
      <h3>📨 进程请求资源</h3>
      <div class="request-form">
        <select v-model="requestForm.processId">
          <option value="">-- 选择进程 --</option>
          <option v-for="p in processes" :key="p.id" :value="p.id">{{ p.id }}</option>
        </select>
        <div class="form-row">
          <input v-model.number="requestForm.requestA" type="number" min="0" placeholder="请求 A" />
          <input v-model.number="requestForm.requestB" type="number" min="0" placeholder="请求 B" />
          <input v-model.number="requestForm.requestC" type="number" min="0" placeholder="请求 C" />
        </div>
        <button @click="requestResources" class="btn-request">发送请求</button>
        <button @click="resetRequest" class="btn-small">恢复</button>
      </div>

      <!-- 请求结果 -->
      <div v-if="requestResult" class="request-result" :class="requestResult.success ? 'success' : 'fail'">
        <p>{{ requestResult.message }}</p>
        <div v-if="requestResult.success && requestResult.safeSequence">
          <strong>新安全序列：</strong>
          <span v-for="(pid, idx) in requestResult.safeSequence" :key="idx">
            {{ pid }}<span v-if="idx < (requestResult.safeSequence?.length ?? 0) - 1"> → </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banker-module {
  padding: 20px;
  max-width: 900px;
}

h2 { margin-bottom: 20px; color: #333; }
h3 { margin: 16px 0 10px; color: #555; font-size: 15px; }
h4 { margin: 10px 0 6px; font-size: 14px; }

/* ==================== 预设 ==================== */
.preset-section { margin-bottom: 16px; }
.preset-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.preset-btn { padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.preset-btn:hover { background: #2980b9; }

/* ==================== 配置 ==================== */
.config-panel {
  background: #f8f9fa; padding: 14px 18px; border-radius: 8px;
  border: 1px solid #e0e0e0; margin-bottom: 16px;
}
.resource-inputs { display: flex; gap: 16px; margin-bottom: 10px; }
.resource-item { display: flex; align-items: center; gap: 6px; }
.resource-item label { font-weight: 600; font-size: 13px; }
.resource-item input { width: 60px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
.available-display { font-size: 14px; color: #2c3e50; padding: 6px 10px; background: #e8f5e9; border-radius: 4px; display: inline-block; }

/* ==================== 表格 ==================== */
.table-panel { margin-bottom: 16px; }
.data-table {
  width: 100%; border-collapse: collapse; background: white;
  border: 1px solid #999; font-size: 14px;
}
.data-table th, .data-table td {
  border: 1px solid #bbb; padding: 6px 8px; text-align: center; font-size: 13px;
}
.data-table th { background: #f0f0f0; font-weight: 600; }
.proc-id { font-weight: 700; color: #2c3e50; }
.highlight { color: #e74c3c; font-weight: 600; }
.btn-del { padding: 4px 10px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
.btn-del:hover { background: #c0392b; }

/* ==================== 添加 ==================== */
.add-panel {
  background: #f0f7ff; padding: 14px 18px; border-radius: 8px;
  border: 1px solid #b3d4ff; margin-bottom: 16px;
}
.add-form { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.id-input { width: 80px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
.form-col { display: flex; flex-direction: column; gap: 4px; }
.form-col label { font-size: 12px; color: #666; font-weight: 600; }
.form-row { display: flex; gap: 6px; }
.form-row input { width: 52px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 13px; }
.btn-add { padding: 6px 18px; background: #42b983; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn-add:hover { background: #38a472; }

/* ==================== 操作按钮 ==================== */
.action-panel { display: flex; gap: 10px; margin-bottom: 16px; }
.btn-check { padding: 10px 22px; background: #9b59b6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
.btn-check:hover { background: #8e44ad; }
.btn-reset { padding: 10px 18px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; }

/* ==================== 结果 ==================== */
.result-panel {
  background: #f5f5f5; padding: 14px 18px; border-radius: 8px;
  border: 1px solid #e0e0e0; margin-bottom: 16px;
}
.result-panel h3 { margin-top: 0; }
.safe-sequence { margin-top: 10px; }
.sequence-steps { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ccc; }
.seq-step { padding: 6px 12px; background: #42b983; color: white; border-radius: 4px; font-weight: 600; font-size: 14px; }
.seq-arrow { color: #888; font-size: 18px; margin: 0 2px; }

/* ==================== 请求 ==================== */
.request-panel {
  background: #fff8e1; padding: 14px 18px; border-radius: 8px;
  border: 1px solid #ffe082; margin-bottom: 16px;
}
.request-form { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.request-form select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
.request-form .form-row input { width: 52px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 13px; }
.btn-request { padding: 6px 18px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn-request:hover { background: #d35400; }
.btn-small { padding: 6px 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }

.request-result { margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 14px; }
.request-result.success { background: #d4edda; border: 1px solid #28a745; color: #155724; }
.request-result.fail { background: #f8d7da; border: 1px solid #dc3545; color: #721c24; }
.request-result p { margin: 0 0 6px; font-weight: 600; }
</style>