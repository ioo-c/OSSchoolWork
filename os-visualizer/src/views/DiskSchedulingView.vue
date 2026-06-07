<script setup lang="ts">
import { ref, reactive, computed, nextTick, watch } from 'vue'

// ==================== 类型定义 ====================
interface DiskResult {
  algorithm: string
  order: number[]         // 访问顺序
  seekSequence: number[]   // 磁头移动轨迹（含起点）
  totalSeek: number
  seekSteps: number[]      // 每步的寻道距离
}

// ==================== 响应式数据 ====================
const initialHead = ref(50)       // 初始磁头位置
const requestsInput = ref('98, 183, 37, 122, 14, 124, 65, 67')  // 请求序列
const trackRange = ref(0)         // 磁道范围 0~199 或动态
const direction = ref<'up' | 'down'>('up')  // SCAN 方向

const requests = ref<number[]>([])
const sstfResult = ref<DiskResult | null>(null)
const scanResult = ref<DiskResult | null>(null)

// 随机生成
const randomCount = ref(10)
const randomMin = ref(0)
const randomMax = ref(199)

// Canvas 引用
const canvasRef = ref<HTMLCanvasElement | null>(null)

// ==================== 解析请求序列 ====================
function parseRequests(): number[] {
  return requestsInput.value
    .split(/[,，\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(Number)
    .filter(n => !isNaN(n))
}

function generateRandom() {
  const arr: number[] = []
  for (let i = 0; i < randomCount.value; i++) {
    arr.push(Math.floor(Math.random() * (randomMax.value - randomMin.value + 1)) + randomMin.value)
  }
  requestsInput.value = arr.join(', ')
  requests.value = arr
}

function applyRequests() {
  requests.value = parseRequests()
  if (requests.value.length === 0) {
    alert('请输入有效的磁道请求序列')
    return
  }
  // 自动计算磁道范围
  const allTracks = [initialHead.value, ...requests.value]
  trackRange.value = Math.max(...allTracks) + 10
}

// ==================== SSTF ====================
function runSSTF(): DiskResult {
  const reqs = [...requests.value]
  const head = initialHead.value
  const seekSequence: number[] = [head]
  const order: number[] = []
  const seekSteps: number[] = []
  let current = head
  let total = 0

  const remaining = [...reqs]

  while (remaining.length > 0) {
    // 找最近的
    let minDist = Infinity
    let minIdx = 0
    for (let i = 0; i < remaining.length; i++) {
      const dist = Math.abs(remaining[i] - current)
      if (dist < minDist) {
        minDist = dist
        minIdx = i
      }
    }

    const next = remaining.splice(minIdx, 1)[0]
    const seek = Math.abs(next - current)
    seekSteps.push(seek)
    total += seek
    current = next
    seekSequence.push(current)
    order.push(current)
  }

  return { algorithm: 'SSTF', order, seekSequence, totalSeek: total, seekSteps }
}

// ==================== SCAN ====================
function runSCAN(): DiskResult {
  const reqs = [...requests.value]
  const head = initialHead.value
  const seekSequence: number[] = [head]
  const order: number[] = []
  const seekSteps: number[] = []
  let current = head
  let total = 0

  // 排序
  const sorted = [...new Set(reqs)].sort((a, b) => a - b)

  if (direction.value === 'up') {
    // 先向上（增大方向）
    const right = sorted.filter(t => t >= current)
    const left = sorted.filter(t => t < current).reverse()

    for (const t of right) {
      const seek = Math.abs(t - current)
      seekSteps.push(seek)
      total += seek
      current = t
      seekSequence.push(current)
      order.push(current)
    }
    for (const t of left) {
      const seek = Math.abs(t - current)
      seekSteps.push(seek)
      total += seek
      current = t
      seekSequence.push(current)
      order.push(current)
    }
  } else {
    // 先向下（减小方向）
    const left = sorted.filter(t => t <= current).reverse()
    const right = sorted.filter(t => t > current)

    for (const t of left) {
      const seek = Math.abs(t - current)
      seekSteps.push(seek)
      total += seek
      current = t
      seekSequence.push(current)
      order.push(current)
    }
    for (const t of right) {
      const seek = Math.abs(t - current)
      seekSteps.push(seek)
      total += seek
      current = t
      seekSequence.push(current)
      order.push(current)
    }
  }

  return {
    algorithm: 'SCAN',
    order,
    seekSequence,
    totalSeek: total,
    seekSteps
  }
}

// ==================== 运行 ====================
function runAll() {
  applyRequests()
  if (requests.value.length === 0) return
  sstfResult.value = runSSTF()
  scanResult.value = runSCAN()
  nextTick(() => drawChart())
}

// ==================== Canvas 折线图 ====================
function drawChart() {
  const canvas = canvasRef.value
  if (!canvas) return

  const sstf = sstfResult.value
  const scan = scanResult.value
  if (!sstf || !scan) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width
  const H = canvas.height
  const pad = { top: 30, right: 30, bottom: 40, left: 50 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  // 清空
  ctx.clearRect(0, 0, W, H)

  // 确定 Y 范围
  const allY = [...sstf.seekSequence, ...scan.seekSequence]
  const maxY = Math.ceil((Math.max(...allY) + 10) / 10) * 10
  const minY = Math.floor((Math.min(...allY) - 5) / 10) * 10

  const scaleX = (x: number, max: number) => pad.left + (x / Math.max(max - 1, 1)) * plotW
  const scaleY = (y: number) => pad.left + pad.top // unused now
  const toY = (val: number) => pad.top + plotH - ((val - minY) / (maxY - minY)) * plotH

  // 背景
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(pad.left, pad.top, plotW, plotH)

  // 网格线
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 0.5
  const gridLines = 8
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (i / gridLines) * plotH
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + plotW, y)
    ctx.stroke()

    // Y 标签
    const val = Math.round(maxY - (i / gridLines) * (maxY - minY))
    ctx.fillStyle = '#888'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(val), pad.left - 8, y + 4)
  }

  // 绘制坐标轴
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pad.left, pad.top)
  ctx.lineTo(pad.left, pad.top + plotH)
  ctx.lineTo(pad.left + plotW, pad.top + plotH)
  ctx.stroke()

  // 标签
  ctx.fillStyle = '#666'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('访问步骤', pad.left + plotW / 2, H - 5)
  ctx.save()
  ctx.translate(12, pad.top + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('磁道号', 0, 0)
  ctx.restore()

  // 辅助函数：绘制一条轨迹
  const drawTrajectory = (result: DiskResult, color: string, dash: boolean) => {
    const seq = result.seekSequence
    if (seq.length < 2) return

    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    if (dash) ctx.setLineDash([6, 4])
    else ctx.setLineDash([])

    ctx.beginPath()
    for (let i = 0; i < seq.length; i++) {
      const x = pad.left + (i / (seq.length - 1)) * plotW
      const y = toY(seq[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // 数据点
    for (let i = 0; i < seq.length; i++) {
      const x = pad.left + (i / (seq.length - 1)) * plotW
      const y = toY(seq[i])
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // 标注值
      ctx.fillStyle = color
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(seq[i]), x, y - 10)
    }
  }

  drawTrajectory(sstf, '#e74c3c', false)
  drawTrajectory(scan, '#3498db', true)

  // 图例
  const legendX = pad.left + plotW - 160
  const legendY = pad.top + 8
  ctx.fillStyle = '#e74c3c'
  ctx.fillRect(legendX, legendY, 16, 3)
  ctx.fillStyle = '#333'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SSTF', legendX + 22, legendY + 4)

  ctx.strokeStyle = '#3498db'
  ctx.setLineDash([6, 4])
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(legendX, legendY + 20)
  ctx.lineTo(legendX + 16, legendY + 20)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillText('SCAN', legendX + 22, legendY + 24)
}

// 监听结果变化重绘
watch([sstfResult, scanResult], () => {
  nextTick(() => drawChart())
})
</script>

<template>
  <div class="disk-module">
    <h2>模块5：磁盘移臂调度模拟</h2>

    <!-- 配置面板 -->
    <div class="config-panel">
      <h3>⚙ 参数设置</h3>
      <div class="config-grid">
        <div class="config-item">
          <label>初始磁头位置</label>
          <input v-model.number="initialHead" type="number" min="0" />
        </div>
        <div class="config-item">
          <label>SCAN 方向</label>
          <select v-model="direction">
            <option value="up">向上（增大方向）</option>
            <option value="down">向下（减小方向）</option>
          </select>
        </div>
        <div class="config-item flex-1">
          <label>磁道请求序列</label>
          <input v-model="requestsInput" class="seq-input" placeholder="用逗号分隔，如: 98, 183, 37, 122" />
        </div>
      </div>
      <div class="config-grid">
        <div class="config-item">
          <label>随机生成</label>
          <input v-model.number="randomCount" type="number" min="3" max="20" class="small-input" placeholder="个数" />
          <input v-model.number="randomMin" type="number" min="0" class="small-input" placeholder="最小" />
          <span>~</span>
          <input v-model.number="randomMax" type="number" min="1" max="300" class="small-input" placeholder="最大" />
          <button @click="generateRandom" class="btn-random">生成随机序列</button>
        </div>
      </div>
      <button @click="runAll" class="btn-run">▶ 运行模拟</button>
    </div>

    <!-- 结果对比 -->
    <div v-if="sstfResult && scanResult" class="results-section">
      <div class="compare-grid">
        <!-- SSTF -->
        <div class="result-card sstf">
          <h3>🟠 SSTF 最短寻道时间优先</h3>
          <div class="stat-line">
            <span>响应顺序：</span>
            <span class="order-seq">{{ sstfResult.order.join(' → ') }}</span>
          </div>
          <div class="stat-line">
            <span>磁头移动总量：</span>
            <strong class="total-seek sstf-color">{{ sstfResult.totalSeek }} 磁道</strong>
          </div>
          <details>
            <summary>详细步骤</summary>
            <div class="detail-steps">
              <div v-for="(step, i) in sstfResult.seekSteps" :key="i" class="step-row">
                步骤 {{ i + 1 }}：{{ sstfResult.seekSequence[i] }} → {{ sstfResult.seekSequence[i + 1] }} （{{ step }} 磁道）
              </div>
            </div>
          </details>
        </div>

        <!-- SCAN -->
        <div class="result-card scan">
          <h3>🔵 SCAN 电梯算法 ({{ direction === 'up' ? '向上' : '向下' }})</h3>
          <div class="stat-line">
            <span>响应顺序：</span>
            <span class="order-seq">{{ scanResult.order.join(' → ') }}</span>
          </div>
          <div class="stat-line">
            <span>磁头移动总量：</span>
            <strong class="total-seek scan-color">{{ scanResult.totalSeek }} 磁道</strong>
          </div>
          <details>
            <summary>详细步骤</summary>
            <div class="detail-steps">
              <div v-for="(step, i) in scanResult.seekSteps" :key="i" class="step-row">
                步骤 {{ i + 1 }}：{{ scanResult.seekSequence[i] }} → {{ scanResult.seekSequence[i + 1] }} （{{ step }} 磁道）
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- 折线图 -->
      <div class="chart-panel">
        <h3>📈 磁头移动轨迹对比图</h3>
        <canvas ref="canvasRef" width="800" height="400" class="chart-canvas"></canvas>
      </div>
    </div>
    <p v-else class="hint">请设置磁道请求序列并点击"运行模拟"</p>
  </div>
</template>

<style scoped>
.disk-module {
  padding: 20px;
  max-width: 1100px;
}

h2 { margin-bottom: 20px; color: #333; }
h3 { margin: 10px 0 8px; color: #555; font-size: 15px; }

/* ==================== 配置 ==================== */
.config-panel {
  background: #f8f9fa; padding: 16px 20px; border-radius: 8px;
  border: 1px solid #e0e0e0; margin-bottom: 20px;
}
.config-grid { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
.config-item { display: flex; align-items: center; gap: 8px; }
.config-item label { font-size: 13px; font-weight: 600; color: #555; white-space: nowrap; }
.config-item input[type="number"] { width: 65px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
.config-item select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
.flex-1 { flex: 1; }
.seq-input { flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; min-width: 250px; }
.small-input { width: 55px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 13px; }
.btn-random { padding: 4px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-run { padding: 10px 30px; background: #42b983; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.btn-run:hover { background: #38a472; }

/* ==================== 结果对比 ==================== */
.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }

.result-card {
  background: #fafafa; padding: 14px 18px; border-radius: 8px; border: 1px solid #e0e0e0;
}
.result-card.sstf { border-left: 4px solid #e74c3c; }
.result-card.scan { border-left: 4px solid #3498db; }

.stat-line { margin: 6px 0; font-size: 14px; display: flex; align-items: flex-start; gap: 8px; }
.order-seq { font-weight: 600; color: #2c3e50; word-break: break-all; }
.total-seek { font-size: 18px; }
.sstf-color { color: #e74c3c; }
.scan-color { color: #3498db; }

.detail-steps { margin-top: 8px; max-height: 200px; overflow-y: auto; font-size: 12px; color: #666; }
.step-row { padding: 2px 0; border-bottom: 1px solid #eee; }
details { margin-top: 8px; }
details summary { cursor: pointer; color: #888; font-size: 13px; }

/* ==================== 图表 ==================== */
.chart-panel {
  background: white; padding: 16px; border-radius: 8px;
  border: 1px solid #ddd;
}
.chart-canvas {
  width: 100%; max-width: 850px; display: block; margin: 0 auto;
  border: 1px solid #eee; border-radius: 4px;
}

.hint { color: #999; font-style: italic; padding: 20px; }

@media (max-width: 768px) {
  .compare-grid { grid-template-columns: 1fr; }
}
</style>