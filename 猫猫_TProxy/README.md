# 猫猫_TProxy - Clash/Mihomo 代理管理插件

用于 F50 随身 Wi-Fi 的 Clash/Mihomo 代理核心管理插件，提供完整的代理配置和管理功能。

## 功能特性

### 核心管理
- **安装/卸载**：一键安装 mihomo-tproxy 核心组件
- **启动/停止/重启**：控制 Clash 内核运行状态
- **开机自启**：设置 Clash 开机自动启动

### 配置管理
- **上传配置**：上传本地 YAML 配置文件
- **编辑配置**：在线编辑完整的 config.yaml
- **备份配置**：一键下载配置文件备份

### 订阅管理
- **订阅链接**：支持最多 3 个订阅链接，自动合并
- **刷新订阅**：可选两种模式
  - **仅更新节点（推荐）**：保留现有 YAML（规则/策略组/DNS 等），通过 `proxy-providers` 拉取最新节点
  - **整份配置重新刷新**：用已保存订阅覆盖整个 `config.yaml`（会冲掉自定义配置）

### 规则管理
- **自定义规则**：可视化添加/删除域名/IP规则
- **策略组选择**：自动读取当前订阅的策略组供选择
- **规则持久化**：自定义规则保存在设备中，不会被订阅更新覆盖

### 内核更新
- **手动上传**：通过 UFI-TOOLS 面板上传内核文件
- **面板更新**：支持通过 zashboard 面板自动更新内核

### 日志查看
- **实时日志**：查看 Clash 运行日志（tail 100行）
- **日志下载**：一键下载完整日志文件

## 工作原理

### 架构
```
UFI-TOOLS (Web界面)
    ↓
插件脚本 (JavaScript)
    ↓
ADB Shell (root权限)
    ↓
Clash/Mihomo 内核
```

### 自定义规则合并机制

插件采用文本级规则合并方式，避免破坏 YAML 锚点和合并标签：

1. **规则存储**：自定义规则保存在 `/data/clash/Proxy/custom_rules.yaml`
2. **规则计数**：使用 `.custom_rules_count` 文件记录合并的规则数量
3. **启动合并**：每次启动时，先删除上次合并的规则，再重新插入新规则
4. **文本操作**：使用 `awk` 和 `sed` 进行文本级操作，确保 YAML 结构完整

### 文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 主配置 | `/data/clash/Proxy/config.yaml` | Clash 内核加载的配置 |
| 自定义规则 | `/data/clash/Proxy/custom_rules.yaml` | 用户添加的规则 |
| 订阅备份 | `/data/clash/Proxy/.sub_url` | Base64 加密的订阅链接 |
| 规则计数 | `/data/clash/Proxy/.custom_rules_count` | 合并规则数量 |
| 合并脚本 | `/data/clash/Scripts/merge_custom_rules.sh` | 规则合并脚本 |
| 启动脚本 | `/data/clash/Scripts/main.sh` | Clash 启动脚本 |
| 内核日志 | `/sdcard/Clash内核日志.txt` | Clash 运行日志 |

## 使用步骤

1. **安装插件**：在 UFI-TOOLS 中上传插件 JS 文件
2. **安装猫猫**：点击「安装」按钮，等待下载完成
3. **配置订阅**：点击「订阅链接」，输入您的订阅地址
4. **添加规则**：点击「自定义规则」，添加需要的域名/IP规则
5. **查看面板**：点击「打开面板」，在浏览器中管理代理

## 配置建议

在 config.yaml 中建议添加以下配置：

```yaml
external-controller: 0.0.0.0:7788
external-ui: /data/clash/UI
external-ui-name: zashboard
external-ui-url: "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"
secret: "123456"
```

## 依赖

- **内核**：mihomo-tproxy（通过插件自动下载）
- **面板**：zashboard（外部 UI）
- **工具**：yq（YAML 处理）、awk、sed

## 注意事项

1. 使用前需开启「高级功能」获取 root 权限
2. 自定义规则格式：`类型,值,策略组`，如 `DOMAIN-SUFFIX,example.com,Proxy`
3. 策略组名称需与配置文件中的一致
4. 「仅更新节点」不会改写 `config.yaml`；「整份配置重新刷新」会覆盖整个配置，请谨慎选择
5. 插件「自定义规则」保存在独立文件中，与整份刷新无关；完整 YAML 内的规则/策略组只有「仅更新节点」模式才能保留
6. 建议定期备份配置文件