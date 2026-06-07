<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'

// ==================== 类型定义 ====================
interface BufferSlot {
  id: number
  state: 'empty' | 'full' | 'consuming'
  producerId?: number
}

// ==================== 响应式数据 ====================
const bufferSize = ref(8)
const numProducers = ref(2)
const numConsumers = ref(2)
const consecutiveN = ref(3) // 消费者连续取 n 个产品
const produceSpeed = ref(1000) // 生产速度 ms
const consumeSpeed = ref(1500) // 消费速度 ms

const buffer = ref<BufferSlot[]>([])
const isRunning = ref(false)
const logs = ref<string[]>([])
const stats = reactive({
  produced: 0,
  consumed: 0,
  blockedProducers: 0,
  blockedConsumers: 0
})

// 信号量
let mutex = 1 // 互斥信号量，保护缓冲区
let empty = 0 // 空槽位数
let full = 0 // 满槽位数
let consumerLock = false // 是否有消费者正在连续取产品
let currentConsumerId: number | null = null // 当前获得连续消费权的消费者
let consumeRemaining = 0 // 当前消费者还需取的产品数

let producerTimers: ReturnType<typeof setInterval>[] = []
let consumerTimers: ReturnType<typeof setInterval>[] = []

// ==================== 计算属性 ====================
const emptyCount = computed(() => buffer.value.filter(s => s.state === 'empty').length)
const fullCount = computed(() => buffer.value.filter(s => s.state === 'full').length)
const consumingCount = computed(() => buffer.value.filter(s => s.state === 'consuming').length)
const bufferUtilization = computed(() => {
  if (buffer.value.length === 0) return '0%'
  return ((fullCount.value / buffer.value.length) * 100).toFixed(0) + '%'
})

// ==================== 初始化缓冲区 ====================
function initBuffer() {
  buffer.value = Array.from({ length: bufferSize.value }, (_, i) => ({
    id: i,
    state: 'empty'
  }))
  mutex = 1
  empty = bufferSize.value
  full = 0
  consumerLock = false
  currentConsumerId = null
  consumeRemaining = 0
  stats.produced = 0
  stats.consumed = 0
  stats.blockedProducers = 0
  stats.blockedConsumers = 0
  logs.value = []
}

// ==================== 信号量操作 ====================
function P(semName: string): boolean {
  if (semName === 'mutex') {
    if (mutex <= 0) return false
    mutex--
    return true
  }
  if (semName === 'empty') {
    if (empty <= 0) return false
    empty--
    return true
  }
  if (semName === 'full') {
    if (full <= 0) return false
    full--
    return true
  }
  return false
}

function V(semName: string) {
  if (semName === 'mutex') mutex++
  if (semName === 'empty') empty++
  if (semName === 'full') full++
}

// ==================== 生产者 ====================
function producerAction(producerId: number) {
  // 1. 生产产品（不需要信号量）
  addLog(`生产者 P${producerId} 准备生产...`)

  // 2. P(empty) - 等待空槽位
  if (!P('empty')) {
    stats.blockedProducers++
    addLog(`⚠ 生产者 P${producerId} 阻塞：无空闲缓冲区`)
    return
  }

  // 3. P(mutex) - 进入临界区
  if (!P('mutex')) {
    V('empty')
    stats.blockedProducers++
    addLog(`⚠ 生产者 P${producerId} 阻塞：互斥锁被占用`)
    return
  }

  // 4. 放入产品
  const emptySlot = buffer.value.find(s => s.state === 'empty')
  if (!emptySlot) {
    V('mutex')
    V('empty')
    return
  }
  emptySlot.state = 'full'
  emptySlot.producerId = producerId
  stats.produced++
  addLog(`✅ 生产者 P${producerId} 在槽 ${emptySlot.id} 放入产品 (已生产 ${stats.produced} 个)`)

  // 5. V(mutex) - 离开临界区
  V('mutex')

  // 6. V(full) - 增加满槽信号量
  V('full')
}

// ==================== 消费者 ====================
function consumerAction(consumerId: number) {
  addLog(`消费者 C${consumerId} 尝试消费...`)

  // 1. 检查是否有其他消费者正在连续消费
  if (consumerLock && currentConsumerId !== consumerId) {
    stats.blockedConsumers++
    addLog(`⚠ 消费者 C${consumerId} 阻塞：消费者 C${currentConsumerId} 正在连续取产品 (还需取 ${consumeRemaining} 个)`)
    return
  }

  // 2. 如果当前消费者获得连续消费权
  if (currentConsumerId === consumerId) {
    // 继续消费剩余的产品
  } else if (!consumerLock) {
    // 获得连续消费权
    consumerLock = true
    currentConsumerId = consumerId
    consumeRemaining = consecutiveN.value
    addLog(`🔒 消费者 C${consumerId} 获得连续消费权，需取 ${consumeRemaining} 个产品`)
  }

  // 3. P(full) - 等待满槽
  if (full <= 0) {
    stats.blockedConsumers++
    addLog(`⚠ 消费者 C${consumerId} 阻塞：无产品可消费`)
    return
  }
  // 注意：在 CS 中先检查再减，避免重复检查

  // 4. P(mutex)
  if (!P('mutex')) {
    V('full')
    stats.blockedConsumers++
    addLog(`⚠ 消费者 C${consumerId} 阻塞：互斥锁被占用`)
    return
  }

  // P(full) 在这里做
  if (!P('full')) {
    V('mutex')
    stats.blockedConsumers++
    addLog(`⚠ 消费者 C${consumerId} 阻塞：无产品可消费`)
    return
  }

  // 5. 取出产品
  const fullSlot = buffer.value.find(s => s.state === 'full')
  if (!fullSlot) {
    V('mutex')
    V('full')
    return
  }
  const slotIndex = fullSlot.id

  // 标记为消费中
  fullSlot.state = 'consuming'

  // 消费完成
  const idx = slotIndex
  setTimeout(() => {
    buffer.value[idx] = {
      id: idx,
      state: 'empty'
    }
    stats.consumed++
    addLog(`🗑 消费者 C${consumerId} 从槽 ${idx} 取走产品 (已消费 ${stats.consumed} 个)`)

    // 连续消费计数减一
    consumeRemaining--

    if (consumeRemaining <= 0) {
      // 释放连续消费权
      consumerLock = false
      currentConsumerId = null
      addLog(`🔓 消费者 C${consumerId} 完成连续消费，释放消费权`)
    }
  }, 300) // 短暂动画延迟

  // 6. V(mutex)
  V('mutex')

  // 7. V(empty)
  V('empty')
}

// ==================== 日志 ====================
function addLog(msg: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift(`[${time}] ${msg}`)
  if (logs.value.length > 200) logs.value.pop()
}

// ==================== 控制 ====================
function start() {
  if (isRunning.value) return
  initBuffer()
  isRunning.value = true

  // 启动生产者
  for (let i = 1; i <= numProducers.value; i++) {
    const pid = i
    producerAction(pid) // 首发一次
    const timer = setInterval(() => {
      producerAction(pid)
    }, produceSpeed.value)
    producerTimers.push(timer)
  }

  // 启动消费者
  for (let i = 1; i <= numConsumers.value; i++) {
    const cid = i
    const timer = setInterval(() => {
      consumerAction(cid)
    }, consumeSpeed.value)
    consumerTimers.push(timer)
  }

  addLog('🚀 模拟开始')
}

function stop() {
  if (!isRunning.value) return
  producerTimers.forEach(clearInterval)
  consumerTimers.forEach(clearInterval)
  producerTimers = []
  consumerTimers = []
  isRunning.value = false
  addLog('🛑 模拟停止')
}

function resetAll() {
  stop()
  initBuffer()
  addLog('🔄 重置完成')
}

onUnmounted(() => {
  stop()
})

// ==================== 调整后重新开始 ====================
function applySettings() {
  if (isRunning.value) {
    stop()
    start()
  }
}

// ==================== 手动生产/消费 ====================
function manualProduce() {
  if (!isRunning.value) {
    initBuffer()
    // 临时设为运行中以便手动操作
  }
  const pid = Math.floor(Math.random() * 100)
  producerAction(pid)
}

function manualConsume() {
  if (!isRunning.value) {
    initBuffer()
  }
  const cid = Math.floor(Math.random() * 100) + 100
  consumerAction(cid)
}
</script>

<template>
  <div class="pc-module">
    <h2>模块2：生产者-消费者同步模拟</h2>

    <!-- 配置面板 -->
    <div class="config-panel">
      <h3>⚙ 参数设置</h3>
      <div class="config-grid">
        <div class="config-item">
          <label>缓冲区大小</label>
          <input v-model.number="bufferSize" type="number" min="3" max="20" @change="applySettings" />
        </div>
        <div class="config-item">
          <label>生产者数量</label>
          <input v-model.number="numProducers" type="number" min="1" max="5" @change="applySettings" />
        </div>
        <div class="config-item">
          <label>消费者数量</label>
          <input v-model.number="numConsumers" type="number" min="1" max="5" @change="applySettings" />
        </div>
        <div class="config-item">
          <label>连续取产品个数 n</label>
          <input v-model.number="consecutiveN" type="number" min="1" max="10" @change="applySettings" />
        </div>
        <div class="config-item">
          <label>生产速度 (ms)</label>
          <input v-model.number="produceSpeed" type="range" min="200" max="5000" step="100" @change="applySettings" />
          <span class="speed-value">{{ produceSpeed }}ms</span>
        </div>
        <div class="config-item">
          <label>消费速度 (ms)</label>
          <input v-model.number="consumeSpeed" type="range" min="200" max="5000" step="100" @change="applySettings" />
          <span class="speed-value">{{ consumeSpeed }}ms</span>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="start" :disabled="isRunning" class="btn-start">▶ 开始模拟</button>
      <button @click="stop" :disabled="!isRunning" class="btn-stop">⏸ 停止</button>
      <button @click="resetAll" class="btn-reset">↻ 重置</button>
      <button v-if="!isRunning" @click="manualProduce" class="btn-manual">手动生产</button>
      <button v-if="!isRunning" @click="manualConsume" class="btn-manual">手动消费</button>
    </div>

    <!-- 信号量状态 -->
    <div class="semaphore-panel">
      <h3>📊 信号量状态</h3>
      <div class="sem-grid">
        <div class="sem-item">
          <span class="sem-label">互斥锁 mutex</span>
          <span class="sem-value" :class="{ zero: mutex === 0 }">{{ mutex }}</span>
        </div>
        <div class="sem-item">
          <span class="sem-label">空槽 empty</span>
          <span class="sem-value" :class="{ zero: empty === 0 }">{{ empty }}</span>
        </div>
        <div class="sem-item">
          <span class="sem-label">满槽 full</span>
          <span class="sem-value" :class="{ zero: full === 0 }">{{ full }}</span>
        </div>
        <div class="sem-item">
          <span class="sem-label">消费者锁</span>
          <span class="sem-value" :class="{ zero: !consumerLock }">
            {{ consumerLock ? `C${currentConsumerId} (剩余${consumeRemaining})` : '无' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 缓冲区可视化 -->
    <div class="buffer-panel">
      <h3>🗃 缓冲区状态 (利用率: {{ bufferUtilization }})</h3>
      <div class="buffer-grid">
        <div
          v-for="slot in buffer"
          :key="slot.id"
          class="buffer-slot"
          :class="slot.state"
        >
          <span class="slot-index">{{ slot.id }}</span>
          <span v-if="slot.state === 'full' || slot.state === 'consuming'" class="slot-content">
            {{ slot.state === 'consuming' ? '⏳' : '📦' }}
          </span>
          <span v-else class="slot-content">—</span>
        </div>
      </div>
      <div class="buffer-legend">
        <span class="legend-item"><span class="legend-color empty-bg"></span> 空</span>
        <span class="legend-item"><span class="legend-color full-bg"></span> 满</span>
        <span class="legend-item"><span class="legend-color consuming-bg"></span> 消费中</span>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-panel">
      <h3>📈 运行统计</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">已生产</span>
          <span class="stat-value produce">{{ stats.produced }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已消费</span>
          <span class="stat-value consume">{{ stats.consumed }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">生产者阻塞次数</span>
          <span class="stat-value block">{{ stats.blockedProducers }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">消费者阻塞次数</span>
          <span class="stat-value block">{{ stats.blockedConsumers }}</span>
        </div>
      </div>
    </div>

    <!-- 运行日志 -->
    <div class="log-panel">
      <h3>📋 运行日志</h3>
      <div class="log-list">
        <div v-for="(log, i) in logs" :key="i" class="log-entry" :class="{ warning: log.includes('⚠'), success: log.includes('✅') || log.includes('🗑'), info: log.includes('🔒') || log.includes('🔓') || log.includes('🚀') || log.includes('🛑') }">
          {{ log }}
        </div>
        <div v-if="logs.length === 0" class="log-empty">暂无日志，点击"开始模拟"</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc-module {
  padding: 20px;
  max-width: 1000px;
}

h2 { margin-bottom: 20px; color: #333; }
h3 { margin: 16px 0 10px; color: #555; font-size: 15px; }

/* ==================== 配置面板 ==================== */
.config-panel {
  background: #f8f9fa;
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  margin-bottom: 16px;
}

.config-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-item label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  white-space: nowrap;
}

.config-item input[type="number"] {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-align: center;
}

.config-item input[type="range"] {
  width: 120px;
}

.speed-value {
  font-size: 12px;
  color: #888;
  min-width: 50px;
}

/* ==================== 控制按钮 ==================== */
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.controls button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start { background: #42b983; color: white; }
.btn-start:hover:not(:disabled) { background: #38a472; }
.btn-stop { background: #e74c3c; color: white; }
.btn-stop:hover:not(:disabled) { background: #c0392b; }
.btn-reset { background: #6c757d; color: white; }
.btn-reset:hover { background: #5a6268; }
.btn-manual { background: #3498db; color: white; }
.btn-manual:hover { background: #2980b9; }

/* ==================== 信号量面板 ==================== */
.semaphore-panel {
  background: #fff8e1;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #ffe082;
  margin-bottom: 16px;
}

.sem-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.sem-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sem-label {
  font-size: 13px;
  color: #666;
}

.sem-value {
  font-size: 16px;
  font-weight: 700;
  color: #42b983;
  background: white;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  min-width: 30px;
  text-align: center;
}

.sem-value.zero {
  color: #e74c3c;
}

/* ==================== 缓冲区 ==================== */
.buffer-panel {
  background: #f0f7ff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #b3d4ff;
  margin-bottom: 16px;
}

.buffer-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 2px dashed #ddd;
  min-height: 70px;
  align-items: center;
}

.buffer-slot {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid #ccc;
  transition: all 0.3s ease;
  font-size: 12px;
}

.buffer-slot.empty {
  background: #fafafa;
  border-color: #ddd;
}

.buffer-slot.full {
  background: #d4edda;
  border-color: #28a745;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.buffer-slot.consuming {
  background: #fff3cd;
  border-color: #ffc107;
  animation: pulse 0.6s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.slot-index {
  font-size: 11px;
  color: #999;
}

.slot-content {
  font-size: 18px;
}

.buffer-legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
  color: #666;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid #aaa;
}

.empty-bg { background: #fafafa; }
.full-bg { background: #d4edda; }
.consuming-bg { background: #fff3cd; }

/* ==================== 统计 ==================== */
.stats-panel {
  background: #f5f5f5;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  margin-bottom: 16px;
}

.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  padding: 2px 12px;
  border-radius: 4px;
  background: white;
  border: 1px solid #ddd;
}

.stat-value.produce { color: #28a745; }
.stat-value.consume { color: #e74c3c; }
.stat-value.block { color: #f39c12; }

/* ==================== 日志 ==================== */
.log-panel {
  background: #2c3e50;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.log-panel h3 {
  color: #ecf0f1;
}

.log-list {
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  padding: 8px;
  background: #1a252f;
  border-radius: 4px;
}

.log-entry {
  padding: 2px 6px;
  color: #bdc3c7;
  border-bottom: 1px solid #2c3e50;
  line-height: 1.6;
}

.log-entry.warning { color: #f39c12; }
.log-entry.success { color: #2ecc71; }
.log-entry.info { color: #3498db; }

.log-empty {
  color: #7f8c8d;
  text-align: center;
  padding: 20px;
  font-style: italic;
}
</style>