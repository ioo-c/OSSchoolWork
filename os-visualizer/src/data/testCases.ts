// src/data/testCases.ts

/**
 * 调度算法测试用例（所有调度算法共用）
 * 包含 id、到达时间、服务时间
 */

export interface ProcessTestCase {
  id: string
  arrivalTime: number
  serviceTime: number
}

export interface SchedulingTestCase {
  id: number
  name: string
  description: string
  processes: ProcessTestCase[]
}

/**
 * 调度算法测试用例集合
 * 后续 RR、SJF、HRN 等算法均可直接使用这组数据
 */
export const schedulingTestCases: SchedulingTestCase[] = [
  {
    id: 1,
    name: "基础案例",
    description: "经典场景，进程到达时间不同，适合对比 FCFS 与其他算法",
    processes: [
      { id: "P1", arrivalTime: 0, serviceTime: 8 },
      { id: "P2", arrivalTime: 1, serviceTime: 4 },
      { id: "P3", arrivalTime: 2, serviceTime: 9 }
    ]
  },
  {
    id: 2,
    name: "全部同时到达",
    description: "所有进程同时到达，可明显看出不同算法的调度差异",
    processes: [
      { id: "P1", arrivalTime: 0, serviceTime: 6 },
      { id: "P2", arrivalTime: 0, serviceTime: 3 },
      { id: "P3", arrivalTime: 0, serviceTime: 8 },
      { id: "P4", arrivalTime: 0, serviceTime: 2 }
    ]
  },
  {
    id: 3,
    name: "长进程护航效应",
    description: "长进程先到达，短进程后到，体现 FCFS 的 convoy effect",
    processes: [
      { id: "P1", arrivalTime: 0, serviceTime: 20 },
      { id: "P2", arrivalTime: 1, serviceTime: 3 },
      { id: "P3", arrivalTime: 2, serviceTime: 4 }
    ]
  },
  {
    id: 4,
    name: "短进程后到",
    description: "短进程较晚到达，适合体现 SJF 的优势",
    processes: [
      { id: "P1", arrivalTime: 0, serviceTime: 5 },
      { id: "P2", arrivalTime: 3, serviceTime: 2 },
      { id: "P3", arrivalTime: 5, serviceTime: 1 }
    ]
  },
  {
    id: 5,
    name: "混合场景",
    description: "到达时间与服务时间较分散，综合测试各种算法表现",
    processes: [
      { id: "P1", arrivalTime: 0, serviceTime: 7 },
      { id: "P2", arrivalTime: 2, serviceTime: 4 },
      { id: "P3", arrivalTime: 4, serviceTime: 1 },
      { id: "P4", arrivalTime: 5, serviceTime: 3 }
    ]
  }
]