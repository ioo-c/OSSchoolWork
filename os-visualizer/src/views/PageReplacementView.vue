<script setup lang="ts">
import { ref, computed } from 'vue'

// ==================== 类型定义 ====================
interface PageFrame {
  page: number | null // null = 空闲
  fault: boolean      // 该时刻是否缺页
}

interface AlgorithmResult {
  frames: number[][][]    // 每个时刻的内存状态 [时刻][帧索引][页面值]
  faults: boolean[]       // 每个时刻是否缺页
  faultCount: number
  faultRate: string
  replacedPages: (number | null)[] // 每个时刻被换出的页面
}

// ==================== 响应式数据 ====================
const frameCount = ref(3)        // 物理块数
const sequenceInput = ref('3, 2, 1, 3, 4, 1, 5, 2, 4, 1, 3, 5') // 页面引用序列
const sequence = ref<number[]>([])

const results = ref<Record<string, AlgorithmResult | null>>({
  OPT: null,
  LRU: null,
  FIFO: null
})

const selectedAlgo = ref<'OPT' | 'LRU' | 'FIFO' | 'ALL'>('ALL')

// 随机生成序列长度
const randomLength = ref(15)
const randomMin = ref(1)
const randomMax = ref(5)

// ==================== 解析序列 ====================
function parseSequence(): number[] {
  const raw = sequenceInput.value
  return raw
    .split(/[,，\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(Number)
    .filter(n => !isNaN(n))
}

function generateRandom() {
  const arr: number[] = []
  for (let i = 0; i < randomLength.value; i++) {
    arr.push(Math.floor(Math.random() * (randomMax.value - randomMin.value + 1)) + randomMin.value)
  }
  sequenceInput.value = arr.join(', ')
  sequence.value = arr
}

function applySequence() {
  sequence.value = parseSequence()
  if (sequence.value.length === 0) {
    alert('请输入有效的页面引用序列')
    return
  }
}

// ==================== OPT 最优置换 ====================
function runOPT(): AlgorithmResult {
  const pages = sequence.value
  const n = pages.length
  const m = frameCount.value
  const frames: number[][][] = []   // [时刻 t][帧 i][页面值]
  const faults: boolean[] = []
  let faultCount = 0
  let currentFrames: (number | null)[] = new Array(m).fill(null)
  const replacedPages: (number | null)[] = []

  for (let t = 0; t < n; t++) {
    const page = pages[t]
    const idx = currentFrames.indexOf(page)

    if (idx !== -1) {
      // 命中
      faults.push(false)
      replacedPages.push(null)
    } else {
      faultCount++
      faults.push(true)

      // 找空闲帧
      const emptyIdx = currentFrames.findIndex(f => f === null)
      if (emptyIdx !== -1) {
        currentFrames[emptyIdx] = page
        replacedPages.push(null) // 无换出
      } else {
        // 选择最远未来才使用的页面换出
        let farthest = -1
        let victim = 0
        for (let i = 0; i < m; i++) {
          const curPage = currentFrames[i]!
          // 在后续引用中查找该页面
          let nextUse = -1
          for (let j = t + 1; j < n; j++) {
            if (pages[j] === curPage) {
              nextUse = j
              break
            }
          }
          // 如果永远不会用到，直接选它
          if (nextUse === -1) {
            victim = i
            break
          }
          if (nextUse > farthest) {
            farthest = nextUse
            victim = i
          }
        }
        const replaced = currentFrames[victim]
        replacedPages.push(replaced)
        currentFrames[victim] = page
      }
    }
    frames.push(currentFrames.map(f => [f ?? -1]))
  }

  return {
    frames,
    faults,
    faultCount,
    faultRate: (faultCount / n * 100).toFixed(1) + '%',
    replacedPages
  }
}

// ==================== LRU 最近最久未使用 ====================
function runLRU(): AlgorithmResult {
  const pages = sequence.value
  const n = pages.length
  const m = frameCount.value
  const frames: number[][][] = []
  const faults: boolean[] = []
  let faultCount = 0
  let currentFrames: (number | null)[] = new Array(m).fill(null)
  const lastUsed: (number | null)[] = new Array(m).fill(null) // 记录每帧的最近使用时间
  const replacedPages: (number | null)[] = []

  for (let t = 0; t < n; t++) {
    const page = pages[t]
    const idx = currentFrames.indexOf(page)

    if (idx !== -1) {
      faults.push(false)
      replacedPages.push(null)
      lastUsed[idx] = t
    } else {
      faultCount++
      faults.push(true)

      const emptyIdx = currentFrames.findIndex(f => f === null)
      if (emptyIdx !== -1) {
        currentFrames[emptyIdx] = page
        lastUsed[emptyIdx] = t
        replacedPages.push(null)
      } else {
        // 找最久未使用的
        let oldest = Infinity
        let victim = 0
        for (let i = 0; i < m; i++) {
          if (lastUsed[i] !== null && lastUsed[i]! < oldest) {
            oldest = lastUsed[i]!
            victim = i
          }
        }
        replacedPages.push(currentFrames[victim])
        currentFrames[victim] = page
        lastUsed[victim] = t
      }
    }
    frames.push(currentFrames.map(f => [f ?? -1]))
  }

  return {
    frames,
    faults,
    faultCount,
    faultRate: (faultCount / n * 100).toFixed(1) + '%',
    replacedPages
  }
}

// ==================== FIFO 先进先出 ====================
function runFIFO(): AlgorithmResult {
  const pages = sequence.value
  const n = pages.length
  const m = frameCount.value
  const frames: number[][][] = []
  const faults: boolean[] = []
  let faultCount = 0
  let currentFrames: (number | null)[] = new Array(m).fill(null)
  const queue: number[] = [] // FIFO 队列（存储帧索引）
  const replacedPages: (number | null)[] = []

  for (let t = 0; t < n; t++) {
    const page = pages[t]
    const idx = currentFrames.indexOf(page)

    if (idx !== -1) {
      faults.push(false)
      replacedPages.push(null)
    } else {
      faultCount++
      faults.push(true)

      const emptyIdx = currentFrames.findIndex(f => f === null)
      if (emptyIdx !== -1) {
        currentFrames[emptyIdx] = page
        queue.push(emptyIdx)
        replacedPages.push(null)
      } else {
        // 换出队列头部对应的帧
        const victim = queue.shift()!
        replacedPages.push(currentFrames[victim])
        currentFrames[victim] = page
        queue.push(victim)
      }
    }
    frames.push(currentFrames.map(f => [f ?? -1]))
  }

  return {
    frames,
    faults,
    faultCount,
    faultRate: (faultCount / n * 100).toFixed(1) + '%',
    replacedPages
  }
}

// ==================== 运行 ====================
function runAll() {
  applySequence()
  if (sequence.value.length === 0) return

  if (selectedAlgo.value === 'ALL') {
    results.value.OPT = runOPT()
    results.value.LRU = runLRU()
    results.value.FIFO = runFIFO()
  } else {
    results.value = { OPT: null, LRU: null, FIFO: null }
    results.value[selectedAlgo.value] =
      selectedAlgo.value === 'OPT' ? runOPT() :
      selectedAlgo.value === 'LRU' ? runLRU() : runFIFO()
  }
}

// ==================== 计算属性 ====================
const displayedResults = computed(() => {
  if (selectedAlgo.value === 'ALL') {
    return ['OPT', 'LRU', 'FIFO'] as const
  }
  return [selectedAlgo.value] as const
})

function algoTitle(algo: string) {
  return { OPT: 'OPT 最佳置换', LRU: 'LRU 最近最久未使用', FIFO: 'FIFO 先进先出' }[algo] ?? algo
}
</script>

<template>
  <div class="pr-module">
    <h2>模块4：页面置换算法模拟</h2>

    <!-- 配置面板 -->
    <div class="config-panel">
      <h3>⚙ 参数设置</h3>
      <div class="config-row">
        <div class="config-item">
          <label>内存物理块数</label>
          <input v-model.number="frameCount" type="number" min="1" max="10" />
        </div>
        <div class="config-item">
          <label>算法选择</label>
          <select v-model="selectedAlgo">
            <option value="ALL">全部对比</option>
            <option value="OPT">OPT</option>
            <option value="LRU">LRU</option>
            <option value="FIFO">FIFO</option>
          </select>
        </div>
      </div>
      <div class="config-row">
        <div class="config-item flex-1">
          <label>页面引用序列</label>
          <input v-model="sequenceInput" class="seq-input" placeholder="用逗号分隔，如: 3, 2, 1, 3, 4" />
        </div>
      </div>
      <div class="config-row">
        <div class="config-item">
          <label>随机生成</label>
          <input v-model.number="randomLength" type="number" min="5" max="30" class="small-input" placeholder="长度" />
          <input v-model.number="randomMin" type="number" min="0" max="9" class="small-input" placeholder="最小值" />
          <span>~</span>
          <input v-model.number="randomMax" type="number" min="1" max="10" class="small-input" placeholder="最大值" />
          <button @click="generateRandom" class="btn-small">生成随机序列</button>
        </div>
      </div>
      <button @click="runAll" class="btn-run">▶ 运行模拟</button>
    </div>

    <!-- 结果展示 -->
    <div v-if="sequence.length > 0" class="results-section">
      <!-- 引用序列 -->
      <div class="seq-display">
        <strong>引用序列：</strong>
        <span v-for="(p, i) in sequence" :key="i" class="seq-page">{{ p }}</span>
      </div>

      <div v-for="algo in displayedResults" :key="algo" class="algo-result">
        <h3>{{ algoTitle(algo) }}</h3>
        <div v-if="results[algo]" class="algo-content">
          <!-- 统计 -->
          <div class="stats-row">
            <span class="stat">缺页次数：<strong class="fault-count">{{ results[algo]!.faultCount }}</strong></span>
            <span class="stat">缺页率：<strong class="fault-rate">{{ results[algo]!.faultRate }}</strong></span>
          </div>

          <!-- 内存状态矩阵表格 -->
          <div class="matrix-wrapper">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="time-header">时刻</th>
                  <th v-for="(_, t) in sequence" :key="t" class="time-header">
                    {{ t + 1 }}
                  </th>
                </tr>
                <tr>
                  <th class="ref-header">引用</th>
                  <th v-for="(p, t) in sequence" :key="t" class="ref-header">
                    {{ p }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fi in frameCount" :key="fi">
                  <td class="frame-label">帧 {{ fi - 1 }}</td>
                  <td
                    v-for="(_, t) in sequence"
                    :key="t"
                    class="frame-cell"
                    :class="{
                      'cell-fault': results[algo]!.faults[t],
                      'cell-hit': !results[algo]!.faults[t] && results[algo]!.frames[t][fi - 1]?.[0] !== undefined && results[algo]!.frames[t][fi - 1]?.[0] !== -1,
                      'cell-empty': results[algo]!.frames[t][fi - 1]?.[0] === -1 || results[algo]!.frames[t][fi - 1]?.[0] === undefined
                    }"
                  >
                    <span v-if="results[algo]!.frames[t][fi - 1]?.[0] !== undefined && results[algo]!.frames[t][fi - 1]?.[0] !== -1">
                      {{ results[algo]!.frames[t][fi - 1]![0] }}
                    </span>
                    <span v-else></span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 换出信息 -->
          <div class="replace-info">
            <span v-for="(rp, t) in results[algo]!.replacedPages" :key="t">
              <span v-if="rp !== null" class="replace-badge">
                时刻 {{ t + 1 }}: 换出页面 {{ rp }}
              </span>
            </span>
          </div>
        </div>
        <p v-else class="no-result">未运行</p>
      </div>
    </div>
    <p v-else class="hint">请输入页面引用序列并点击"运行模拟"</p>
  </div>
</template>

<style scoped>
.pr-module {
  padding: 20px;
  max-width: 1100px;
}

h2 { margin-bottom: 20px; color: #333; }
h3 { margin: 14px 0 8px; color: #555; font-size: 15px; }

/* ==================== 配置 ==================== */
.config-panel {
  background: #f8f9fa; padding: 16px 20px; border-radius: 8px;
  border: 1px solid #e0e0e0; margin-bottom: 20px;
}
.config-row { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
.config-item { display: flex; align-items: center; gap: 8px; }
.config-item label { font-size: 13px; font-weight: 600; color: #555; white-space: nowrap; }
.config-item input[type="number"] { width: 60px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
.config-item select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
.flex-1 { flex: 1; }
.seq-input { flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; min-width: 300px; }
.small-input { width: 50px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 13px; }
.btn-small { padding: 4px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-run { padding: 10px 30px; background: #42b983; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.btn-run:hover { background: #38a472; }

/* ==================== 序列显示 ==================== */
.seq-display {
  padding: 10px; background: white; border: 1px solid #ddd; border-radius: 6px;
  margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
}
.seq-page {
  display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center;
  background: #e8f4fd; border: 1px solid #b3d4ff; border-radius: 4px;
  font-size: 13px; font-weight: 600; color: #2c3e50;
}

/* ==================== 算法结果 ==================== */
.algo-result {
  background: #fafafa; padding: 14px; border-radius: 8px;
  border: 1px solid #e0e0e0; margin-bottom: 16px;
}
.stats-row { display: flex; gap: 30px; margin-bottom: 12px; }
.stat { font-size: 14px; }
.fault-count { color: #e74c3c; font-size: 16px; }
.fault-rate { color: #e67e22; font-size: 16px; }

/* ==================== 内存矩阵 ==================== */
.matrix-wrapper {
  overflow-x: auto; margin-bottom: 12px;
  border: 1px solid #ccc; border-radius: 4px;
}
.matrix-table {
  border-collapse: collapse; font-size: 13px; min-width: 100%;
}
.matrix-table th, .matrix-table td {
  border: 1px solid #ddd; padding: 5px 8px; text-align: center;
  min-width: 36px;
}
.time-header { background: #f0f0f0; font-weight: 600; font-size: 12px; color: #666; }
.ref-header { background: #fff3cd; font-weight: 700; color: #e67e22; font-size: 14px; }
.frame-label { background: #f0f0f0; font-weight: 600; color: #555; white-space: nowrap; font-size: 12px; }

.frame-cell { transition: all 0.2s; }
.cell-fault {
  background: #ffe0e0 !important;
  border: 2px solid #e74c3c !important;
  font-weight: 700;
  color: #c0392b;
}
.cell-hit {
  background: #d4edda;
  color: #155724;
  font-weight: 600;
}
.cell-empty {
  background: #f9f9f9;
  color: #ccc;
}

/* ==================== 换出信息 ==================== */
.replace-info { display: flex; flex-wrap: wrap; gap: 8px; }
.replace-badge {
  padding: 3px 8px; background: #ffeeba; border: 1px solid #ffc107;
  border-radius: 3px; font-size: 12px; color: #856404;
}

.hint { color: #999; font-style: italic; padding: 20px; }
.no-result { color: #aaa; font-style: italic; }
</style>