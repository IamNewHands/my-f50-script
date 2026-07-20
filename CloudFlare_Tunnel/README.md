# CloudFlare_Tunnel - CloudFlare Tunnel 内网穿透插件

用于 F50 随身 Wi-Fi 的 CloudFlare Tunnel 内网穿透管理插件，支持公网访问、私网组网（WARP）和双模式。

## 功能特性

### 多模式支持
- **公网访问模式**：通过域名公开访问 F50 设备（如 `https://f50.yourdomain.com`）
- **私网组网模式**：WARP 内网互联，不暴露公网，最高安全级别
- **双模式**：公网域名 + WARP 私网同时支持

### 核心管理
- **安装/卸载**：自动下载安装 cloudflared 二进制（多镜像源）
- **启动/停止/重启**：控制隧道服务运行状态
- **开机自启**：自动写入启动脚本，设备重启后自动运行

### 配置管理
- **模式选择**：下拉切换公网/私网/双模式，自动显示对应配置区域
- **config.yml 生成**：根据模式自动生成隧道配置文件
- **配置持久化**：所有设置保存在设备 `/data/cloudflared/plugin_config.json`
- **私网路由注册**：启动时自动通过 API 注册 CIDR 路由到 Cloudflare

### 诊断与日志
- **状态检查**：显示 PID、运行时长、CPU/内存占用、config.yml 内容
- **日志查看**：最近 100 行日志，自动识别 5 种常见错误
- **启动诊断**：启动失败时自动检查文件、权限、配置、日志

### 操作说明
- 每个控制按钮旁配有「操作说明」按钮（安装/启动/重启/状态/日志/卸载）
- 模式选择、Token 获取、WARP 配置均有独立帮助弹窗
- 内置完整使用帮助（含 Cloudflare 控制台 + WARP 客户端指引）

## 工作原理

### 架构
```
UFI-TOOLS (Web界面)
    ↓
插件脚本 (JavaScript)
    ↓
ADB Shell (root权限)
    ↓
cloudflared 内核 (ARM64)
    ↓
Cloudflare 全球网络
    ↓
  ├── 公网模式：浏览器通过域名访问
  └── 私网模式：WARP 客户端通过内网 IP 访问
```

### 三种模式

| 模式 | config.yml 配置 | 访问方式 | 安全级别 |
|------|----------------|---------|---------|
| 公网 | ingress + hostname | `https://域名` | 中（建议加 Access） |
| 私网 | warp-routing: enabled | `http://内网IP` | 高 |
| 双模式 | ingress + warp-routing | 域名或内网IP | 最高 |

### 文件路径
| 文件 | 路径 | 说明 |
|------|------|------|
| 二进制 | `/data/cloudflared/cloudflared` | cloudflared 可执行文件 |
| 配置 | `/data/cloudflared/config.yml` | 隧道配置文件（自动生成） |
| Token | `/data/cloudflared/token.txt` | 隧道认证 Token |
| 插件配置 | `/data/cloudflared/plugin_config.json` | 插件设置（持久化） |
| PID | `/data/cloudflared/cloudflared.pid` | 进程 ID |
| 日志 | `/data/cloudflared/cloudflared.log` | 运行日志 |
| 自启动 | `/sdcard/ufi_tools_boot.sh` | 开机自启动脚本 |

## 使用步骤

### 1. 安装插件
在 UFI-TOOLS 中上传 `UFI-TOOLS_Plugins_CloudFlare_Tunnel.js` 文件

### 2. Cloudflare 控制台准备
- 登录 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
- 创建隧道并获取 Token
- 公网模式：配置 Public Hostname
- 私网模式：配置 Private Network CIDR + 创建 API Token（权限 Account/Tunnel:Edit）

### 3. 插件操作
- 选择模式 → 填写配置 → 点击安装 → 点击启动
- 点击各按钮旁的「说明」查看详细操作指引

### 4. 客户端访问
- 公网模式：浏览器直接访问配置的域名（建议开启 Cloudflare Access）
- 私网模式：安装 WARP 客户端 → 登录团队 → 访问内网 IP

## 依赖
- **设备**：F50 随身 Wi-Fi（ARM64）
- **权限**：UFI-TOOLS 高级功能（Root）
- **工具**：curl 或 wget（下载 cloudflared）
- **网络**：设备须能访问互联网

## 注意事项
1. 使用前需开启「高级功能」获取 root 权限
2. 公网模式建议配合 Cloudflare Access 添加身份验证
3. 私网模式需访问设备安装 WARP 客户端
4. 弱口令检测：UFI-TOOLS 密码不能为弱密码（admin、123456 等）
5. Token/API Token 存储在设备本地，如设备丢失请在 Cloudflare 控制台撤销
6. 卸载会删除 `/data/cloudflared/` 所有文件，操作不可逆
