# CloudFlare_Tunnel - CloudFlare Tunnel 内网穿透插件

用于 F50 随身 Wi-Fi（UFI-TOOLS）的 CloudFlare Tunnel 管理插件，支持公网访问、私网组网（WARP）和双模式。

**安全建议（公网必做）**：使用公网域名访问时，请在 Cloudflare Zero Trust 配置 **Access 登录验证**，在 UFI 登录页前再加一层身份校验。插件本身不负责 Access；详见下文「Cloudflare Access 配置」。

---

## 功能特性

### 运行模式

| 模式 | 访问方式 | 说明 |
|------|----------|------|
| **公网访问** | `https://你的域名` | 需 Tunnel Token + Public Hostname |
| **私网组网 (WARP)** | `http://内网IP` | 需 API Token + CIDR，仅 WARP 客户端可访问 |
| **双模式** | 域名 + 内网 IP | 同时启用 ingress 与 warp-routing |

### 服务控制

| 按钮 | 作用 |
|------|------|
| **安装 Tunnel** | 从 GitHub 官方下载 `cloudflared-linux-arm64` 并安装到 `/data/cloudflared/` |
| **启动服务** | 写 config.yml、Token 文件，按正确 CLI 顺序启动，并写入开机脚本 |
| **停止服务** | 结束 cloudflared 进程，**保留**安装与配置（可再启动） |
| **重启服务** | 停止后按当前配置重新拉起 |
| **禁用自启动** | 从 `/sdcard/ufi_tools_boot.sh` 移除启动行，设备重启不再自动开隧道 |
| **检查状态** | 独立弹窗：PID / 时长 / CPU / 内存 / config.yml，可刷新、复制 |
| **查看日志** | 独立弹窗：最近 100 行，可滚动、刷新、复制 |
| **卸载** | 杀进程 + 删 `/data/cloudflared/` + 清自启动（需点两次确认） |

### 其它

- 配置持久化：`/data/cloudflared/plugin_config.json`
- Token 以文件形式存放，启动使用 `--token-file`（避免 shell 特殊字符）
- 弱口令检测：UFI 为弱密码时拒绝敏感操作
- 各按钮配有操作说明弹窗

---

## 工作原理

```
UFI-TOOLS 插件面板
    → Root Shell
    → cloudflared (ARM64)
    → Cloudflare 边缘
         ├── 公网：浏览器 →（建议 Access）→ 隧道 → 本机服务
         └── 私网：WARP 客户端 → 私网路由 → 内网 IP
```

### 启动命令约定（重要）

cloudflared 要求 **`--config` 在 `run` 之前**，**`--token-file` 在 `run` 之后**：

```bash
# 正确
./cloudflared tunnel --config /data/cloudflared/config.yml run --token-file /data/cloudflared/token.txt

# 错误（会报 flag provided but not defined: -config）
./cloudflared tunnel run --token ... --config ...
```

### 设备文件路径

| 路径 | 说明 |
|------|------|
| `/data/cloudflared/cloudflared` | 二进制 |
| `/data/cloudflared/config.yml` | 自动生成的隧道配置 |
| `/data/cloudflared/token.txt` | 隧道 Token（**勿提交到 Git**） |
| `/data/cloudflared/plugin_config.json` | 插件 UI 配置（**勿含真实 Token 提交到公开仓**） |
| `/data/cloudflared/cloudflared.pid` | PID |
| `/data/cloudflared/cloudflared.log` | 日志 |
| `/sdcard/ufi_tools_boot.sh` | 开机自启脚本片段 |

---

## 使用步骤

### 1. 安装插件

在 UFI-TOOLS 中上传本目录下的 `UFI-TOOLS_Plugins_CloudFlare_Tunnel.js`。

### 2. Cloudflare 控制台

1. 打开 [Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**
2. 创建隧道，复制 **Tunnel Token**
3. **公网**：在隧道 **Public Hostname** 中配置子域名 → 本机服务（如 `http://127.0.0.1:2333`）
4. **私网**：配置 **Private Network** CIDR；并创建 API Token（权限含 Account / Cloudflare Tunnel: Edit）

### 3. 插件内操作

1. 选择模式，填写 Token / 域名 / 本地服务（及私网相关项）
2. **安装 Tunnel** → 等待 GitHub 下载完成（看 Toast 进度与日志）
3. **启动服务** → **检查状态** 确认为运行中
4. 临时关闭：先 **停止服务**，若不想开机再开再 **禁用自启动**

### 4. 访问

- 公网：浏览器访问你的域名（**务必配置 Access，见下节**）
- 私网：设备安装 [WARP](https://one.one.one.one/) → Zero Trust 团队登录 → 访问内网 IP

---

## Cloudflare Access 配置（公网登录验证）

在 UFI 账号密码之前增加 Cloudflare 身份验证，**未通过验证看不到 UFI 页面**。

1. Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. **Application domain**：与隧道 Public Hostname 完全一致（例如 `f50.example.com`）
3. **Policy**：Action = **Allow**
   - 常用：**Emails** 填你的邮箱（访问时邮箱 OTP / One-time PIN）
   - 或：**IP ranges** 仅允许固定公网 IP
4. 保存后，用无痕窗口打开域名，应先出现 Cloudflare 登录页，通过后才是 UFI

说明：

- Access 在边缘生效，**无需改插件或 cloudflared 配置**
- 与 UFI 自身密码叠加，推荐公网长期开启
- 撤销保护：删除该 Access 应用或调整 Policy

---

## 关闭隧道怎么做

| 需求 | 操作 |
|------|------|
| 只关当前进程，保留安装配置 | **停止服务** |
| 关进程且开机不再自启 | **停止服务** + **禁用自启动** |
| 完全删除 | **卸载**（不可逆） |

---

## 依赖与环境

- 设备：F50 等 ARM64 环境 + UFI-TOOLS 高级功能（Root）
- 下载：GitHub 官方 Release（`cloudflared-linux-arm64`），需设备能访问 GitHub
- 网络：出站访问 Cloudflare 边缘

---

## 隐私与仓库安全

本仓库 **只包含插件脚本与说明**，不应出现：

- 真实 Tunnel Token / API Token
- 个人域名、团队名、邮箱（说明中仅用占位符）
- 设备日志、`config.yml` / `token.txt` 实装内容

Token 与配置仅保存在 **设备本地** `/data/cloudflared/`。设备丢失或 Token 泄露时，请在 Cloudflare 控制台 **轮换/撤销** 隧道 Token 与 API Token。

贡献或 fork 时请检查 diff，勿把本机导出的配置提交进公开仓库。

---

## 常见问题

| 现象 | 原因 / 处理 |
|------|-------------|
| `flag provided but not defined: -config` | CLI 参数顺序错误；请使用本仓库最新插件（`--config` 在 `run` 前） |
| 日志只有帮助信息、进程立刻退出 | 多为参数/Token 问题；更新插件后重装启动逻辑，检查 Token 是否完整 |
| 安装很久无结果 | 看日志中的 `[INSTALL]` 步骤；确认设备能访问 GitHub |
| 开机又自动开了隧道 | 启动时写过自启脚本，点 **禁用自启动** |
| 公网谁都能打开登录页 | 配置 **Cloudflare Access**（见上文） |

---

## 文件说明

```
CloudFlare_Tunnel/
├── README.md                                 # 本说明
├── .gitignore
└── UFI-TOOLS_Plugins_CloudFlare_Tunnel.js    # UFI-TOOLS 插件脚本
```
