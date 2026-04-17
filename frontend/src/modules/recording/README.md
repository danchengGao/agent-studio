# Recording Module

`recording` 模块负责 3 件事：
1. 录制 DeepSearch 主流程 SSE 事件
2. 录制报告改写（rewrite）子流程事件，并把它们挂到同一条录制会话上
3. 回放历史录制，或在开发态下复用历史 rewrite 结果做 Mock

快速接手版本先看：

- [QUICKSTART.md](./QUICKSTART.md)

推荐阅读顺序：
1. [index.ts](./index.ts)
2. [store.ts](./store.ts)
3. [integrations/useDeepSearchRecordingBridge.ts](./integrations/useDeepSearchRecordingBridge.ts)
4. [core/Recorder.ts](./core/Recorder.ts)
5. [core/Player.ts](./core/Player.ts)
6. [middleware/RewriteMockManager.ts](./middleware/RewriteMockManager.ts)
7. [constants.ts](./constants.ts)
8. [__tests__/](./__tests__)

## 目录结构

```text
recording/
├─ index.ts
├─ README.md
├─ QUICKSTART.md
├─ store.ts
├─ constants.ts
├─ config/
├─ core/
│  ├─ Recorder.ts
│  ├─ Player.ts
│  └─ types.ts
├─ integrations/
│  ├─ index.ts
│  └─ useDeepSearchRecordingBridge.ts
├─ middleware/
│  ├─ SSEMiddleware.ts
│  ├─ RewriteMiddleware.ts
│  ├─ RewriteMockManager.ts
│  └─ MiddlewareManager.ts
├─ storage/
├─ types/
├─ ui/
│  └─ hooks/
├─ utils/
└─ __tests__/
```

## 核心概念

### 1. RecordingSession

一条完整录制会话包含：
- `events`: DeepSearch 主流程 SSE 事件
- `rewriteEvents`: 与这次会话相关的所有改写事件
- `metadata`: 扩展信息，比如 `agentType`、`conversationId`、`rewriteCount`

### 2. 主流程录制

主流程录制的是用户发起一次 DeepSearch 后，服务端持续返回的 SSE 事件流。

现在页面层推荐入口不是直接碰 `recorder`，而是通过 bridge：

- [integrations/useDeepSearchRecordingBridge.ts](./integrations/useDeepSearchRecordingBridge.ts)

典型调用链：
1. `createMainFlowRecording({ enabled, query, metadata })`
2. SSE 到来时 `handle.record(event)`
3. 流结束时 `handle.stop()`

### 3. Rewrite 录制

rewrite 不是独立 session，而是附着在最近一次主流程录制上的子事件流。

关键设计在 [core/Recorder.ts](./core/Recorder.ts)：
- `currentSession`: 当前正在录制的主流程
- `rewriteTargetSession`: rewrite 最终要追加到哪条主流程录制

这意味着主流程结束后，只要用户还在当前报告上继续改写，rewrite 仍然会继续追加到同一条录制里。

### 4. Rewrite Mock

rewrite Mock 用来复用历史 rewrite 结果，避免每次都真实请求后端。

当前推荐链路：
1. `RecordingPanel` 选中录制并打开 Mock
2. `loadRewriteMockEvents(rewriteEvents)` 把历史数据灌进 `RewriteMockManager`
3. 业务侧调用 `tryMockRewrite(request, onEvent)`
4. 命中时派发 `MOCK_RESULT`，并直接回放历史 rewrite SSE

## 模块如何装配

[store.ts](./store.ts) 是整个模块的 runtime container。

初始化时会创建：
- `storage`: 默认是 `IndexedDBStorage`
- `recorder`: `RecorderImpl`
- `player`: `PlayerImpl`
- `rewriteMockManager`: `RewriteMockManager`
- `rewriteMiddleware`: `RewriteMiddleware`
- `middlewareManager`: `MiddlewareManagerImpl`

因此 `store` 不只是状态仓库，它更像模块装配中心。

## 推荐接入方式

### 页面层

页面层优先使用：
- `useRecording`
- `usePlayback`
- `useRecordingList`
- `useDeepSearchRecordingBridge`
- `usePlaybackEventBridge`

不要优先直接在业务代码里操作 `recorder`、`player`、`storage` 或手写 browser event。

### 当前 AppsPage 集成点

当前主集成点是：

- [../../pages/Apps/AppsPage.tsx](../../pages/Apps/AppsPage.tsx)

它现在负责：
- 通过 `createMainFlowRecording()` 管理主流程录制 handle
- 通过 `createRewriteRecording()` 管理 rewrite 录制 handle
- 通过 `tryMockRewrite()` 先尝试 rewrite Mock
- 通过 `usePlaybackEventBridge()` 消费 `PLAYBACK_EVENT`

### 当前调试面板

当前调试 UI 在：

- [../../components/Conversation/RecordingPanel.tsx](../../components/Conversation/RecordingPanel.tsx)

它负责：
- 展示录制列表
- 选择录制并回放
- 加载 rewrite Mock 数据
- 展示 `matched / pending / not-matched` 状态

## Browser Events

模块内统一使用这些 typed browser events：

- `SAVED`
  有新录制持久化完成，列表可以刷新
- `DELETED`
  录制删除或清空后，列表可以刷新
- `PLAYBACK_EVENT`
  回放器吐出一条 SSE，业务页再转给 `ConversationStore`
- `MOCK_RESULT`
  一次 rewrite Mock 是否命中，用来驱动调试面板状态

统一定义在：

- [constants.ts](./constants.ts)

不要在外部手写原始事件字符串。

## Rewrite 匹配规则

rewrite 匹配规则集中在：

- [utils/rewriteRequest.ts](./utils/rewriteRequest.ts)

分 3 层：
1. `isSameRewriteRequest`
2. `isRelaxedRewriteRequestMatch`
3. `isFuzzyRewriteRequestMatch`

`RewriteMockManager` 和 `RecordingPanel` 都依赖这套规则，避免 UI 和命中逻辑分叉。

## 测试

当前模块已经有一组可直接运行的测试：

- [__tests__/RecorderImpl.test.ts](./__tests__/RecorderImpl.test.ts)
- [__tests__/RewriteMockManager.test.ts](./__tests__/RewriteMockManager.test.ts)
- [__tests__/PlayerImpl.test.ts](./__tests__/PlayerImpl.test.ts)
- [__tests__/useDeepSearchRecordingBridge.test.tsx](./__tests__/useDeepSearchRecordingBridge.test.tsx)

运行方式：

```bash
npm run test:recording
```

当前覆盖重点：
- 主流程录制落盘
- rewrite 挂载到最近一次主流程 session
- rewrite mock 顺序消费
- Player 的回放/暂停/停止
- bridge 的主流程 handle / rewrite handle / playback event / mock 事件

## 扩展建议

如果后面继续扩展，优先遵守这几条：
1. 新事件先加到 [constants.ts](./constants.ts) 的 typed event map
2. rewrite 匹配规则只改 [utils/rewriteRequest.ts](./utils/rewriteRequest.ts)
3. 页面层优先走 bridge 和 hooks，不要重新回到手写事件/底层实例
4. 如果要支持别的存储后端，优先实现 `RecordingStorage`
5. 如果要加更多录制相关回归保护，优先补 `__tests__/`

## 当前取舍

当前仍然有两个明确取舍：

1. 回放事件仍通过 browser event 传给业务页
   现在已经做成 typed helper，但本质仍是跨模块事件通信
2. 主流程录制和 rewrite 录制共用同一条 session
   这让调试更连续，但 session 语义是“一次报告及其后续改写”，不是“单次 HTTP 请求”

如果后面继续重构，最值得优先抽象的仍然是“业务页如何消费回放事件”这一层。
