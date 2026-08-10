# F50 随身 Wi-Fi 插件仓库

F50 / UFI-TOOLS 插件与配置模板集合。

仓库：https://github.com/IamNewHands/my-f50-script

---

## 目录结构

```
.
├── 猫猫_TProxy/              # Clash/Mihomo 代理管理插件
│   ├── README.md
│   └── UFI-TOOLS_Plugins_猫猫_TProxy.js
├── CloudFlare_Tunnel/        # CloudFlare Tunnel 内网穿透插件
│   ├── README.md             # 含 Access 登录验证、启停说明
│   └── UFI-TOOLS_Plugins_CloudFlare_Tunnel.js
├── openlist/                 # OpenList 文件列表管理插件
│   ├── README.md
│   └── UFI-TOOLS_Plugins_OpenList.js
├── APK安装器/                # APK 安装 / 应用卸载插件
│   ├── README.md
│   └── UFI-TOOLS_Plugins_APK安装器.js
├── MihomoPro_Config.yaml     # Mihomo 配置模板（订阅地址请自行填写）
└── README.md
```

---

## 插件列表

| 插件 | 目录 | 功能摘要 |
|------|------|----------|
| [猫猫_TProxy](./猫猫_TProxy/README.md) | `猫猫_TProxy/` | Clash/Mihomo 管理；刷新订阅支持「仅更新节点 / 整份覆盖」等 |
| [CloudFlare_Tunnel](./CloudFlare_Tunnel/README.md) | `CloudFlare_Tunnel/` | 公网 / WARP 私网 / 双模式；安装·启停·自启·状态·日志 |
| [OpenList](./openlist/README.md) | `openlist/` | 一键安装/启停 OpenList 文件列表；内嵌 Web UI 面板；快捷路径收藏；日志实时查看与导出 |
| [APK安装器](./APK安装器/README.md) | `APK安装器/` | 面板内安装 APK（上传 → pm install）；列出/卸载全部第三方应用，带分页与进度提示 |

### CloudFlare Tunnel 要点

- **下载源**：GitHub 官方 `cloudflared-linux-arm64`（非镜像站）
- **关闭隧道**：「停止服务」保留文件；「禁用自启动」取消开机拉起；「卸载」彻底删除
- **公网安全**：请在 Cloudflare Zero Trust 配置 **Access**（邮箱 OTP / IP 白名单等），不要只依赖 UFI 登录页  
  步骤见 [CloudFlare_Tunnel/README.md](./CloudFlare_Tunnel/README.md#cloudflare-access-配置公网登录验证)

### 猫猫：刷新订阅模式

| 模式 | 说明 |
|------|------|
| **仅更新节点（推荐）** | 不改写整份 `config.yaml`，只更新节点源 |
| **整份配置重新刷新** | 用订阅覆盖配置，可能冲掉自定义规则 |

详见 [猫猫_TProxy/README.md](./猫猫_TProxy/README.md)。

### OpenList 要点

- **安装**：点击「安装OpenList」自动下载解压并设置开机自启，默认密码 `admin`
- **Web 界面**：展开面板即可在内嵌 iframe 中操作，或点击「新标签页打开」
- **快捷路径**：收藏常用路径（如 `/data/clash/Proxy/WebUI/zashboard`），点击即跳转
- **日志**：点击「查看日志」实时刷新（1.5 秒间隔），支持暂停/继续；也可点击「导出运行日志」下载完整文件
- 安装前需确保已开启「高级功能」（Root），且设备可访问互联网

详见 [openlist/README.md](./openlist/README.md)。

### APK安装器 要点

- **安装 APK**：点击「📲 安装 APK」选择本机 `.apk` 文件，自动上传到设备并 `pm install -r`（覆盖安装），完成后自动清理临时文件
- **卸载应用**：列表只显示**第三方应用**包名（`pm list packages -3`），每页 10 条，卸载有二次确认
- **环境自检**：未开「高级功能」（Root）或非 Android 环境时插件拒绝加载并给出提示
- **刷新列表**：带实时进度提示（扫描数量 / 百分比）

详见 [APK安装器/README.md](./APK安装器/README.md)。

---

## 使用方法

1. 打开 UFI-TOOLS → 上传插件
2. 选择对应目录下的 `UFI-TOOLS_Plugins_*.js`
3. 上传后在面板中使用各功能按钮

---

## 隐私与安全

- **不要**把 Tunnel Token、API Token、真实订阅链接、账号密码提交到本仓库
- 设备上的 `/data/cloudflared/token.txt`、`plugin_config.json` 等仅存本机
- `MihomoPro_Config.yaml` 为模板：订阅 URL、面板 `secret` 等请改成自己的，勿使用示例默认值对外暴露面板
- 公网穿透务必开启 **Cloudflare Access**（或等价门禁）+ 强 UFI 密码

---

## 注意事项

- 需开启 UFI-TOOLS「高级功能」（Root）
- 插件会修改设备文件与进程，操作前建议备份
- 卸载 / 停止前请确认是否仍需远程访问
