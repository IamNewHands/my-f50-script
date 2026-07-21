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
├── MihomoPro_Config.yaml     # Mihomo 配置模板（订阅地址请自行填写）
└── README.md
```

---

## 插件列表

| 插件 | 目录 | 功能摘要 |
|------|------|----------|
| [猫猫_TProxy](./猫猫_TProxy/README.md) | `猫猫_TProxy/` | Clash/Mihomo 管理；刷新订阅支持「仅更新节点 / 整份覆盖」等 |
| [CloudFlare_Tunnel](./CloudFlare_Tunnel/README.md) | `CloudFlare_Tunnel/` | 公网 / WARP 私网 / 双模式；安装·启停·自启·状态·日志 |

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
