# OpenList - OpenList 文件列表管理插件

用于 F50 随身 Wi-Fi 的 [OpenList](https://github.com/OpenListTeam/OpenList) 文件列表程序管理插件，一键安装/启停，并在面板内直接嵌入 OpenList Web 界面，支持快捷路径收藏与日志实时查看。

## 功能特性

### 核心管理
- **安装/卸载**：一键下载 `openlist-android-arm64` 并解压到 `/data/openlist`
- **启动/停止/重启**：控制 OpenList 服务运行状态
- **开机自启**：写入 `/sdcard/ufi_tools_boot.sh`，设备重启后自动运行
- **更新**：下载新版覆盖安装并重启服务

### Web 界面
- **内嵌面板**：在插件面板内通过 iframe 直接打开 OpenList Web UI（`5244` 端口）
- **新标签页打开**：在独立浏览器标签页中打开 OpenList 首页
- **刷新网页**：重载内嵌 iframe（带时间戳防缓存）

### 快捷路径收藏
- **路径收藏**：收藏常用路径（如 `/data/clash/Proxy/WebUI/zashboard`），点击即在新标签页跳转
- **多个维护**：支持添加/删除多条快捷路径
- **路径兼容**：支持相对路径（自动拼接设备 IP）或完整 URL
- **本地持久化**：收藏列表保存在浏览器 `localStorage`，刷新页面不丢失

### 日志查看
- **查看日志**：面板内实时刷新运行日志（每 1.5 秒拉取最新 200 行，自动滚动到底部）
- **暂停/继续**：阅读时可暂停自动刷新
- **导出运行日志**：将完整日志拷贝并下载为文件

## 工作原理

### 架构
```
UFI-TOOLS (Web界面)
    ↓
插件脚本 (JavaScript)
    ↓
ADB Shell (root权限)
    ↓
openlist-android-arm64 内核
    ↓
OpenList Web UI (0.0.0.0:5244)
```

### 启动流程
1. 通过 `nohup` 后台启动 `openlist-android-arm64 server`，输出重定向到日志文件
2. 轮询启动日志，识别到 `start HTTP server` 与 `0.0.0.0:5244` 后判定启动成功
3. 启动成功后刷新内嵌 iframe 加载 Web 界面

### 文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 二进制 | `/data/openlist/openlist-android-arm64` | OpenList 可执行文件 |
| 数据目录 | `/data/openlist/data` | 配置与数据 |
| 运行日志 | `/data/openlist/data/log/log.log` | 运行时日志 |
| 启动日志 | `/sdcard/openlist_log.log` | nohup 启动输出 |
| 自启动 | `/sdcard/ufi_tools_boot.sh` | 开机自启动脚本 |
| Web 端口 | `5244` | OpenList Web UI 端口 |

## 使用步骤

1. **安装插件**：在 UFI-TOOLS 中上传 `UFI-TOOLS_Plugins_OpenList.js`
2. **安装 OpenList**：点击「安装OpenList」，等待下载、解压、设置自启动并启动服务
3. **访问 Web 界面**：展开面板查看内嵌界面，或点击「新标签页打开」访问 `http://设备IP:5244`
4. **登录**：默认账号密码均为 `admin`（建议安装后立即在 Web 界面修改）
5. **收藏快捷路径**：点击「快捷路径」→ 输入路径（如 `/data/clash/Proxy/WebUI/zashboard`）→ 添加，之后点击收藏项即在新标签页打开
6. **查看日志**：点击「查看日志」实时查看运行日志，或点击「导出运行日志」下载完整日志

## 依赖

- **设备**：F50 随身 Wi-Fi（ARM64）
- **权限**：UFI-TOOLS 高级功能（Root）
- **工具**：curl（下载组件）、tar（解压）、tail（日志读取）
- **网络**：设备须能访问互联网（下载源 `pan.kanokano.cn`）

## 注意事项

1. 使用前需开启「高级功能」获取 root 权限
2. 默认账号密码均为 `admin`，建议安装后立即在 OpenList Web 界面修改密码
3. 快捷路径收藏保存在浏览器 `localStorage`（按域名存储），更换浏览器或清除缓存后会丢失
4. Web 端口默认 `5244`，请确保未与设备上其他服务冲突
5. 卸载会删除 `/data/openlist/` 所有文件并取消开机自启，操作不可逆
6. 「查看日志」实时刷新依赖 root 读取日志文件，关闭面板时会自动停止刷新