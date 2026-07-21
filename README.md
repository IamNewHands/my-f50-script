# F50 随身 Wi-Fi 插件仓库

这是一个用于 F50 随身 Wi-Fi 的插件集合，提供各种增强功能。

## 目录结构

```
.
├── 猫猫_TProxy/          # Clash/Mihomo 代理管理插件
│   ├── README.md         # 插件详细说明
│   ├── .gitignore        # Git 忽略配置
│   └── UFI-TOOLS_Plugins_猫猫_TProxy.js  # UFI-TOOLS 插件脚本
├── CloudFlare_Tunnel/    # CloudFlare Tunnel 内网穿透插件
│   ├── README.md         # 插件详细说明
│   ├── .gitignore        # Git 忽略配置
│   └── UFI-TOOLS_Plugins_CloudFlare_Tunnel.js  # UFI-TOOLS 插件脚本
├── MihomoPro_Config.yaml # Mihomo 完整配置模板（proxy-providers，需自行填写订阅）
└── README.md             # 本文件
```

## 插件列表

| 插件 | 目录 | 功能 |
|------|------|------|
| [猫猫_TProxy](./猫猫_TProxy/README.md) | `猫猫_TProxy/` | Clash/Mihomo 代理核心管理；刷新订阅支持「仅更新节点 / 整份覆盖」两种模式；自定义规则、内核更新等 |
| [CloudFlare_Tunnel](./CloudFlare_Tunnel/README.md) | `CloudFlare_Tunnel/` | CloudFlare Tunnel 内网穿透，支持公网访问/私网WARP组网/双模式 |

### 猫猫：刷新订阅两种模式

| 模式 | 说明 |
|------|------|
| **仅更新节点（推荐）** | 不改写 `config.yaml`，只通过 `proxy-providers` 拉取最新节点，规则/策略组/DNS 保留 |
| **整份配置重新刷新** | 用已保存订阅覆盖整个 `config.yaml`，会冲掉当前自定义配置 |

完整说明见 [猫猫_TProxy/README.md](./猫猫_TProxy/README.md)。

## 使用方法

1. 在 F50 随身 Wi-Fi 的 UFI-TOOLS 界面中找到「上传插件」功能
2. 选择对应插件目录下的 `.js` 文件
3. 上传后插件会自动加载，在面板中显示对应的操作按钮

## 注意事项

- 所有插件运行需要开启「高级功能」（获取 root 权限）
- 插件操作会修改设备文件系统，请谨慎操作
- 建议在使用前备份设备数据
