//<script>
(() => {
    // ============================================================
    //  CloudFlare Tunnel 内网穿透插件 - 完整版
    //  支持模式：公网访问 | 私网组网(WARP) | 双模式
    //  运行环境：UFI-TOOLS (ARM64 Android/Linux)
    // ============================================================

    // ==================== 弱口令检测 ====================
    const checkWeakToken = () => {
        if (SHA256) {
            let weakTokenList = [
                "admin", "password", "666", "6666",
                "12345", "123456", "1234567", "12345678", "123456789", "1234567890",
                "root",
            ];
            for (let token of weakTokenList) {
                if (SHA256(token) == KANO_TOKEN.toUpperCase()) {
                    return true;
                }
            }
            return false;
        }
    };

    // ==================== Toast消息管理器 ====================
    const ToastManager = {
        currentToast: null,
        clear: () => {
            if (ToastManager.currentToast) {
                ToastManager.currentToast.remove();
                ToastManager.currentToast = null;
            }
        },
        success: (message, duration = 3000) => {
            ToastManager.clear();
            ToastManager.currentToast = createToast(message, 'green', duration);
        },
        error: (message, duration = 5000) => {
            ToastManager.clear();
            ToastManager.currentToast = createToast(message, 'red', duration);
        },
        warning: (message, duration = 4000) => {
            ToastManager.clear();
            ToastManager.currentToast = createToast(message, 'orange', duration);
        },
        info: (message, duration = 3000) => {
            ToastManager.clear();
            ToastManager.currentToast = createToast(message, '#38bdf8', duration);
        },
        loading: (message) => {
            ToastManager.clear();
            ToastManager.currentToast = createToast(`\u23F3 ${message}`, '#fbbf24', 2000);
        },
        guide: (title, content, duration = 30000) => {
            ToastManager.clear();
            const styledContent = `\n=== ${title} ===\n\n${content}\n\n(点击关闭或等待自动消失)`;
            ToastManager.currentToast = createToast(styledContent, '#60a5fa', duration);
        },
    };

    // ==================== 权限校验 ====================
    const checkAdvanceFunc = async () => {
        const res = await runShellWithRoot('whoami');
        if (res.content && res.content.includes('root')) { return true; }
        return false;
    };
    const validateAdvancedPermission = async () => {
        if (!(await checkAdvanceFunc())) { ToastManager.error("没有开启高级功能，无法使用！"); return false; }
        return true;
    };

    // ==================== CloudFlare Tunnel 路径配置 ====================
    const CLOUDFLARE_CONFIG = {
        get INSTALL_DIR() { return "/data/cloudflared"; },
        get BINARY_PATH() { return `${this.INSTALL_DIR}/cloudflared`; },
        get PID_FILE() { return `${this.INSTALL_DIR}/cloudflared.pid`; },
        get LOG_FILE() { return `${this.INSTALL_DIR}/cloudflared.log`; },
        get TOKEN_FILE() { return `${this.INSTALL_DIR}/token.txt`; },
        get CONFIG_FILE() { return `${this.INSTALL_DIR}/config.yml`; },
        get PLUGIN_CONFIG_FILE() { return `${this.INSTALL_DIR}/plugin_config.json`; },
        BOOT_SCRIPT_PATH: "/sdcard/ufi_tools_boot.sh",
        DOWNLOAD_URL: "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64",
        TEMP_DOWNLOAD_PATH: "/data/cloudflared_download",
    };

    // ==================== 插件配置系统 ====================
    let PLUGIN_CONFIG = {
        mode: "public",
        public: { hostname: "", service: "http://127.0.0.1:80" },
        private: { cidrList: ["192.168.8.0/24"], apiToken: "", teamName: "" },
    };

    const savePluginConfig = async () => {
        const configJson = JSON.stringify(PLUGIN_CONFIG);
        let b64 = "";
        try { b64 = btoa(unescape(encodeURIComponent(configJson))); }
        catch (e) { b64 = btoa(configJson); }
        await runShellWithRoot(`
            mkdir -p ${CLOUDFLARE_CONFIG.INSTALL_DIR}
            echo '${b64}' | base64 -d > ${CLOUDFLARE_CONFIG.PLUGIN_CONFIG_FILE}
            chmod 644 ${CLOUDFLARE_CONFIG.PLUGIN_CONFIG_FILE}
        `);
    };

    const loadPluginConfig = async () => {
        const res = await runShellWithRoot(`cat ${CLOUDFLARE_CONFIG.PLUGIN_CONFIG_FILE} 2>/dev/null`);
        if (!res.success || !res.content || !res.content.trim()) return false;
        try { const config = JSON.parse(res.content.trim()); PLUGIN_CONFIG = { ...PLUGIN_CONFIG, ...config }; return true; }
        catch (e) { return false; }
    };

    // ==================== 全局状态变量 ====================
    let cloudflaredProcessId = null;
    let currentToken = null;
    let statusCache = { data: null, timestamp: 0, ttl: 5000 };

    // ==================== 服务状态检测 ====================
    const isServiceRunning = async (useCache = true) => {
        const now = Date.now();
        if (useCache && statusCache.data && (now - statusCache.timestamp) < statusCache.ttl) {
            return statusCache.data;
        }
        try {
            const checkRes = await runShellWithRoot(`
                if [ -f ${CLOUDFLARE_CONFIG.PID_FILE} ]; then
                    PID=$(cat ${CLOUDFLARE_CONFIG.PID_FILE} 2>/dev/null)
                    if [ -n "$PID" ] && ps -p $PID -o comm= 2>/dev/null | grep -q cloudflared; then
                        echo "RUNNING:$PID"
                    else echo "NOT_RUNNING"; fi
                else echo "NO_PID_FILE"; fi
            `);
            const result = checkRes.success && checkRes.content.startsWith("RUNNING:")
                ? { running: true, pid: checkRes.content.split(":")[1].trim() }
                : { running: false, pid: null };
            statusCache = { data: result, timestamp: now, ttl: statusCache.ttl };
            return result;
        } catch (error) {
            const result = { running: false, pid: null };
            statusCache = { data: result, timestamp: now, ttl: statusCache.ttl };
            return result;
        }
    };

    const stopService = async () => {
        const stopRes = await runShellWithRoot(`pkill cloudflared 2>/dev/null; sleep 2; rm -f ${CLOUDFLARE_CONFIG.PID_FILE}; echo "STOPPED"`);
        return stopRes.success;
    };

    // ==================== Token 提取 ====================
    const extractToken = (() => {
        const TOKEN_REGEX = /^[A-Za-z0-9+/=]+$/;
        const INSTALL_REGEX = /install\s+([A-Za-z0-9+/=]+)/;
        const TOKEN_PARAM_REGEX = /--token\s+([A-Za-z0-9+/=]+)/;
        return (input) => {
            if (!input || !input.trim()) return null;
            const t = input.trim();
            const im = t.match(INSTALL_REGEX); if (im) return im[1];
            const tm = t.match(TOKEN_PARAM_REGEX); if (tm) return tm[1];
            if (TOKEN_REGEX.test(t) && t.length > 50) return t;
            return null;
        };
    })();

    // ==================== 下载工具检测 ====================
    const getDownloader = async () => {
        const check = async (cmd) => { const r = await runShellWithRoot(`which ${cmd} 2>/dev/null`); return r.success && r.content.trim().length > 0; };
        if (await check('curl')) return 'curl -L -o';
        if (await check('wget')) return 'wget -O';
        const builtinCurl = '/data/data/com.minikano.f50_sms/files/curl';
        const test = await runShellWithRoot(`test -x ${builtinCurl} && echo yes`);
        if (test.success && test.content.trim() === 'yes') return `${builtinCurl} -L -o`;
        return null;
    };

    const checkFileSize = async (path, minSize = 1024 * 1024) => {
        const r = await runShellWithRoot(`stat -c%s "${path}" 2>/dev/null || echo 0`);
        if (!r.success) return false;
        return parseInt(r.content.trim()) > minSize;
    };

    const downloadWithRetry = async (downloader, url, output, retries = 2, timeout = 300) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            const cmd = `${downloader} ${output} "${url}" --connect-timeout 30 --max-time ${timeout}`;
            ToastManager.loading(`下载尝试 ${attempt}/${retries}...`);
            const res = await runShellWithRoot(cmd, (timeout + 10) * 1000);
            if (res.success) { const valid = await checkFileSize(output); if (valid) return true; await runShellWithRoot(`rm -f ${output}`); }
            if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
        }
        return false;
    };

    // ==================== config.yml 生成 ====================
    const generateConfigYml = () => {
        const c = PLUGIN_CONFIG;
        let yml = `# CloudFlare Tunnel Configuration\n# Generated by UFI-TOOLS Plugin\n# Mode: ${c.mode}\n\n`;
        yml += `ingress:\n`;
        if ((c.mode === "public" || c.mode === "both") && c.public.hostname) {
            yml += `  - hostname: ${c.public.hostname}\n  - service: ${c.public.service}\n`;
        }
        yml += `  - service: http_status:404\n`;
        if (c.mode === "private" || c.mode === "both") {
            yml += `\nwarp-routing:\n  enabled: true\n`;
        }
        return yml;
    };

    const writeConfigYml = async () => {
        const ymlContent = generateConfigYml();
        let b64 = "";
        try { b64 = btoa(unescape(encodeURIComponent(ymlContent))); } catch (e) { b64 = btoa(ymlContent); }
        const res = await runShellWithRoot(`echo '${b64}' | base64 -d > ${CLOUDFLARE_CONFIG.CONFIG_FILE}; chmod 644 ${CLOUDFLARE_CONFIG.CONFIG_FILE}; echo "OK"`);
        return res.success && res.content.includes("OK");
    };

    // ==================== 私网路由配置 ====================
    const configurePrivateRoutes = async () => {
        const { cidrList, apiToken } = PLUGIN_CONFIG.private;
        if (!cidrList || cidrList.length === 0) return true;
        if (!apiToken) { ToastManager.error("私网模式需要配置 Cloudflare API Token！\n获取方式：Cloudflare Dashboard → API令牌 → 创建 → 权限Account/Tunnel:Edit"); return false; }
        ToastManager.loading("正在配置私网路由...");
        for (const cidr of cidrList) {
            const cc = cidr.trim(); if (!cc) continue;
            const res = await runShellWithRoot(`CLOUDFLARE_API_TOKEN='${apiToken}' ${CLOUDFLARE_CONFIG.BINARY_PATH} tunnel route ip add ${cc}`, 30000);
            if (!res.success) { ToastManager.error(`私网路由 ${cc} 配置失败\n${res.content}\n检查：API Token权限(Tunnel:Edit)/CIDR格式/网络`); return false; }
        }
        return true;
    };

    const logInstallStep = async (step, message) => {
        const timestamp = new Date().toLocaleString('zh-CN');
        await runShellWithRoot(`echo "[${timestamp}] [INSTALL] ${step}: ${message}" >> ${CLOUDFLARE_CONFIG.LOG_FILE}`);
    };

    // ==================== 核心操作：安装 ====================
    const installCloudflared = async () => {
        if (checkWeakToken()) { ToastManager.error("弱口令，请更改后再操作！", 8000); return; }
        if (!(await validateAdvancedPermission())) return;
        try {
            await runShellWithRoot(`mkdir -p ${CLOUDFLARE_CONFIG.INSTALL_DIR}; echo "[INSTALL] 安装开始" > ${CLOUDFLARE_CONFIG.LOG_FILE}`);

            // 步骤1：检查是否已安装
            ToastManager.info("[1/5] 检查是否已安装...", 2000);
            const ck = await runShellWithRoot(`ls -la ${CLOUDFLARE_CONFIG.BINARY_PATH} 2>/dev/null`);
            if (ck.success && ck.content.includes("cloudflared")) {
                ToastManager.warning("CloudFlare Tunnel 已安装，无需重复安装");
                await logInstallStep("SKIP", "已安装，跳过");
                return;
            }
            ToastManager.success("[1/5] 检查通过，未安装");
            await logInstallStep("CHECK", "未安装，开始安装");

            // 步骤2：创建目录
            ToastManager.info("[2/5] 创建安装目录...", 2000);
            const mk = await runShellWithRoot(`mkdir -p ${CLOUDFLARE_CONFIG.INSTALL_DIR}; chmod 755 ${CLOUDFLARE_CONFIG.INSTALL_DIR}`);
            if (!mk.success) {
                await logInstallStep("FAIL", "创建目录失败");
                throw new Error("创建安装目录失败，请检查权限");
            }
            ToastManager.success(`[2/5] 目录创建成功: ${CLOUDFLARE_CONFIG.INSTALL_DIR}`);
            await logInstallStep("DIR", `创建目录: ${CLOUDFLARE_CONFIG.INSTALL_DIR}`);

            // 步骤3：检测下载工具
            ToastManager.info("[3/5] 检测下载工具...", 2000);
            const dl = await getDownloader();
            if (!dl) {
                await logInstallStep("FAIL", "未找到下载工具");
                throw new Error("未找到 curl 或 wget，无法下载。请确保设备已安装 curl 或 wget。");
            }
            ToastManager.success(`[3/5] 下载工具就绪: ${dl.split(' ')[0]}`);
            await logInstallStep("DL_TOOL", `下载工具: ${dl.split(' ')[0]}`);

            // 步骤4：从 GitHub 下载
            ToastManager.info(`[4/5] 正在从 GitHub 下载 cloudflared...\n来源: ${CLOUDFLARE_CONFIG.DOWNLOAD_URL}\n\n预计耗时: 30-120秒\n如超过2分钟未完成，请检查网络后重试`, 5000);
            await logInstallStep("DOWNLOAD", `开始下载: ${CLOUDFLARE_CONFIG.DOWNLOAD_URL}`);
            
            const startTime = Date.now();
            const downloaded = await downloadWithRetry(dl, CLOUDFLARE_CONFIG.DOWNLOAD_URL, CLOUDFLARE_CONFIG.TEMP_DOWNLOAD_PATH, 3, 600);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            
            if (!downloaded) {
                await logInstallStep("FAIL", `下载失败，耗时${elapsed}秒`);
                ToastManager.error(`下载失败!\n\n耗时: ${elapsed}秒\n来源: ${CLOUDFLARE_CONFIG.DOWNLOAD_URL}\n\n可能原因：\n1. 网络无法访问GitHub\n2. 网络速度过慢\n3. 下载超时\n\n手动安装方法：\n1. 电脑浏览器打开 https://github.com/cloudflare/cloudflared/releases/latest\n2. 下载 cloudflared-linux-arm64 文件\n3. 通过 UFI-TOOLS 文件管理上传到 /data/cloudflared/cloudflared\n4. 回到本页重新点击「安装 Tunnel」`, 20000);
                return;
            }
            ToastManager.success(`[4/5] 下载完成! 耗时: ${elapsed}秒`);
            await logInstallStep("DOWNLOAD", `下载成功，耗时${elapsed}秒`);

            // 步骤5：部署并验证
            ToastManager.info("[5/5] 部署文件并验证...", 2000);
            await logInstallStep("DEPLOY", "开始部署文件");
            
            const su = await runShellWithRoot(`
                mv "${CLOUDFLARE_CONFIG.TEMP_DOWNLOAD_PATH}" "${CLOUDFLARE_CONFIG.BINARY_PATH}"
                chmod 755 "${CLOUDFLARE_CONFIG.BINARY_PATH}"
                "${CLOUDFLARE_CONFIG.BINARY_PATH}" --version
            `);
            
            if (!su.success || !su.content.includes("cloudflared")) {
                await logInstallStep("FAIL", "文件部署或验证失败");
                throw new Error("文件部署或验证失败，请重试");
            }
            
            const version = su.content.trim();
            ToastManager.success(`安装成功!\n\n版本: ${version}\n路径: ${CLOUDFLARE_CONFIG.BINARY_PATH}\n耗时: ${Math.floor((Date.now() - startTime) / 1000)}秒\n\n下一步：填写配置后点击「启动服务」`, 15000);
            await logInstallStep("SUCCESS", `安装成功，版本: ${version}`);
        } catch (e) { 
            await logInstallStep("ERROR", e.message);
            ToastManager.error(`安装失败: ${e.message}`); 
        }
    };

    // ==================== 核心操作：启动 ====================
    const startCloudflared = async () => {
        if (checkWeakToken()) { return createToast("弱口令，请更改后再操作！", "red", 8000); }
        if (!(await validateAdvancedPermission())) return;
        const mode = PLUGIN_CONFIG.mode;
        if (mode === "public" || mode === "both") {
            const ti = document.getElementById('cloudflare_token_input').value.trim();
            if (!ti) { ToastManager.error("请输入隧道Token！\n获取：Cloudflare Zero Trust → Networks → Tunnels → 创建隧道 → 复制Token"); return; }
            const t = extractToken(ti);
            if (!t) { ToastManager.error("无法提取有效Token！\n支持格式：1.完整命令 2.直接粘贴token"); return; }
            currentToken = t;
        }
        if (mode === "private" || mode === "both") {
            const at = document.getElementById('cf_api_token_input').value.trim();
            if (!at) { ToastManager.error("私网模式需要API Token！\n获取：Dashboard → 个人资料 → API令牌 → 创建 → 权限Account/Tunnel:Edit"); return; }
            PLUGIN_CONFIG.private.apiToken = at;
        }
        try {
            ToastManager.loading("检查安装...");
            const ck = await runShellWithRoot(`ls -la ${CLOUDFLARE_CONFIG.BINARY_PATH} 2>/dev/null`);
            if (!ck.success || !ck.content.includes("cloudflared")) { ToastManager.error("未安装，请先点击安装"); return; }
            const { running, pid } = await isServiceRunning(false);
            if (running) { ToastManager.warning(`已在运行 (PID: ${pid})`); return; }
            if (currentToken) { const st = await runShellWithRoot(`echo "${currentToken}" > ${CLOUDFLARE_CONFIG.TOKEN_FILE}`); if (!st.success) throw new Error("保存Token失败"); }
            await savePluginConfig();
            ToastManager.loading("生成配置...");
            if (!(await writeConfigYml())) throw new Error("写入config.yml失败");
            await runShellWithRoot(`rm -f ${CLOUDFLARE_CONFIG.LOG_FILE}`);
            if (mode === "private" || mode === "both") { if (!(await configurePrivateRoutes())) return; }
            ToastManager.loading("启动服务...");
            await runShellWithRoot(`
                cd ${CLOUDFLARE_CONFIG.INSTALL_DIR}; chmod 755 .; chmod +x ./cloudflared;
                nohup ./cloudflared tunnel run --config "${CLOUDFLARE_CONFIG.CONFIG_FILE}" > ${CLOUDFLARE_CONFIG.LOG_FILE} 2>&1 &
                echo $! > ${CLOUDFLARE_CONFIG.PID_FILE}; sleep 1
            `);
            ToastManager.loading("配置自启动...");
            const bootCmd = `cd ${CLOUDFLARE_CONFIG.INSTALL_DIR} && nohup ./cloudflared tunnel run --config ${CLOUDFLARE_CONFIG.CONFIG_FILE} > ${CLOUDFLARE_CONFIG.LOG_FILE} 2>&1 &`;
            await runShellWithRoot(`touch ${CLOUDFLARE_CONFIG.BOOT_SCRIPT_PATH}; chmod 777 ${CLOUDFLARE_CONFIG.BOOT_SCRIPT_PATH}; sed -i '/cloudflared tunnel/d' ${CLOUDFLARE_CONFIG.BOOT_SCRIPT_PATH}; echo "${bootCmd}" >> ${CLOUDFLARE_CONFIG.BOOT_SCRIPT_PATH}`);
            const pr = await runShellWithRoot(`cat ${CLOUDFLARE_CONFIG.PID_FILE}`); if (pr.success && pr.content) cloudflaredProcessId = pr.content.trim();
            ToastManager.loading("验证...");
            let v = false;
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 500));
                const { running: ir, pid: sp } = await isServiceRunning(false);
                if (ir) { v = true; cloudflaredProcessId = sp;
                    let msg = `启动成功! PID: ${sp}`;
                    if (mode === "public" || mode === "both") msg += `\n地址: https://${PLUGIN_CONFIG.public.hostname || '见CF控制台'}`;
                    if (mode === "private" || mode === "both") msg += `\nCIDR: ${PLUGIN_CONFIG.private.cidrList.join(', ')}\nWARP客户端可访问内网`;
                    ToastManager.success(msg); break;
                }
            }
            if (!v) { const di = await diagnosisStartupFailure(); ToastManager.error(`启动失败\n${di}\n建议：检查Token/配置/日志/网络`); }
        } catch (e) { ToastManager.error(`启动失败: ${e.message}`); }
    };

    // ==================== 核心操作：重启 ====================
    const restartCloudflared = async () => {
        if (checkWeakToken()) { return createToast("弱口令，请更改后再操作！", "red", 8000); }
        if (!(await validateAdvancedPermission())) return;
        try {
            ToastManager.loading("停止服务..."); await stopService();
            ToastManager.loading("重新启动...");
            if (!(await writeConfigYml())) throw new Error("config.yml失败");
            const sr = await runShellWithRoot(`cd ${CLOUDFLARE_CONFIG.INSTALL_DIR}; chmod +x ./cloudflared; nohup ./cloudflared tunnel run --config "${CLOUDFLARE_CONFIG.CONFIG_FILE}" > ${CLOUDFLARE_CONFIG.LOG_FILE} 2>&1 &; echo $! > ${CLOUDFLARE_CONFIG.PID_FILE}`);
            if (!sr.success) throw new Error(`重启失败: ${sr.content}`);
            ToastManager.loading("验证..."); await new Promise(r => setTimeout(r, 3000));
            const { running: rn, pid: rp } = await isServiceRunning(false);
            if (rn) ToastManager.success(`重启成功! PID: ${rp}`); else ToastManager.warning("可能失败，请检查状态");
        } catch (e) { ToastManager.error(`重启失败: ${e.message}`); }
    };

    // ==================== 核心操作：卸载 ====================
    const uninstallCloudflared = async () => {
        if (!(await validateAdvancedPermission())) return;
        try {
            ToastManager.loading("卸载中...");
            const ur = await runShellWithRoot(`pkill cloudflared 2>/dev/null; sleep 1; rm -rf ${CLOUDFLARE_CONFIG.INSTALL_DIR}; sed -i '/cloudflared tunnel/d' ${CLOUDFLARE_CONFIG.BOOT_SCRIPT_PATH}; echo "DONE"`);
            if (!ur.success) throw new Error("卸载失败");
            cloudflaredProcessId = null; currentToken = null; statusCache = { data: null, timestamp: 0, ttl: 5000 };
            document.getElementById('cloudflare_token_input').value = '';
            document.getElementById('cf_api_token_input').value = '';
            document.getElementById('private_cidr_input').value = '';
            ToastManager.success("卸载完成，所有文件已清除");
        } catch (e) { ToastManager.error(e.message); }
    };

    // ==================== 诊断与日志 ====================
    const diagnosisStartupFailure = async () => {
        try {
            const d = await runShellWithRoot(`
                echo "===诊断===";
                if [ -f ${CLOUDFLARE_CONFIG.BINARY_PATH} ]; then echo "[OK]二进制存在"; if [ -x ${CLOUDFLARE_CONFIG.BINARY_PATH} ]; then echo "[OK]权限正常"; else echo "[FAIL]无执行权限"; fi; else echo "[FAIL]二进制不存在"; fi
                if [ -f ${CLOUDFLARE_CONFIG.TOKEN_FILE} ] && [ -s ${CLOUDFLARE_CONFIG.TOKEN_FILE} ]; then echo "[OK]Token存在"; else echo "[INFO]Token无(私网模式无需)"; fi
                if [ -f ${CLOUDFLARE_CONFIG.CONFIG_FILE} ]; then echo "[OK]config.yml:"; cat ${CLOUDFLARE_CONFIG.CONFIG_FILE}; else echo "[FAIL]config.yml不存在"; fi
                if [ -f ${CLOUDFLARE_CONFIG.LOG_FILE} ]; then echo "[INFO]日志:"; tail -10 ${CLOUDFLARE_CONFIG.LOG_FILE} 2>/dev/null || echo "读取失败"; else echo "[INFO]无日志"; fi
                echo "===结束==="
            `);
            return d.success ? d.content : "诊断出错";
        } catch (e) { return `诊断出错: ${e.message}`; }
    };

    const ERROR_PATTERNS = [
        { pattern: /(authentication failed|invalid token)/i, message: "【分析】Token认证失败" },
        { pattern: /(connection refused|network|timeout)/i, message: "【分析】网络连接问题" },
        { pattern: /permission denied/i, message: "【分析】权限不足" },
        { pattern: /tunnel not found/i, message: "【分析】隧道未找到" },
        { pattern: /config.*error/i, message: "【分析】config.yml配置错误" },
    ];

    const showLogViewer = () => {
        const existing = document.getElementById('CLOUDFLARE_LOG_VIEWER');
        if (existing) { existing.remove(); }
        
        const viewer = document.createElement('div');
        viewer.id = 'CLOUDFLARE_LOG_VIEWER';
        viewer.style.cssText = `
            position: fixed; top: 10%; left: 5%; right: 5%; bottom: 10%;
            background: #1e1e2e; border-radius: 12px; border: 1px solid #444;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 9999;
            display: flex; flex-direction: column; overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; background: #2a2a3e; border-bottom: 1px solid #444;
        `;
        
        const title = document.createElement('div');
        title.textContent = '📋 日志查看器 (最近100行)';
        title.style.cssText = 'color: #fff; font-weight: bold; font-size: 14px;';
        
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px;';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            padding: 4px 12px; background: #3b82f6; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 12px; background: #10b981; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = `
            padding: 4px 12px; background: #ef4444; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        actions.appendChild(refreshBtn);
        actions.appendChild(copyBtn);
        actions.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(actions);
        
        const content = document.createElement('div');
        content.id = 'cloudflare_log_content';
        content.style.cssText = `
            flex: 1; padding: 12px; overflow-y: auto;
            font-family: 'Courier New', monospace; font-size: 12px;
            line-height: 1.5; color: #ccc; white-space: pre-wrap; word-break: break-all;
        `;
        content.textContent = '加载中...';
        
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 8px 16px; background: #2a2a3e; border-top: 1px solid #444;
            font-size: 11px; color: #888; text-align: right;
        `;
        footer.id = 'cloudflare_log_footer';
        footer.textContent = '日志路径: /data/cloudflared/cloudflared.log';
        
        viewer.appendChild(header);
        viewer.appendChild(content);
        viewer.appendChild(footer);
        document.body.appendChild(viewer);
        
        closeBtn.addEventListener('click', () => viewer.remove());
        
        const loadLogs = async () => {
            try {
                const lr = await runShellWithRoot(`tail -100 ${CLOUDFLARE_CONFIG.LOG_FILE} 2>/dev/null || echo "日志不存在"`);
                if (!lr.success) { content.textContent = '无法读取日志'; return; }
                const lc = lr.content || "暂无日志";
                content.textContent = lc;
                const lines = lc.split('\n').filter(l => l.trim()).length;
                footer.textContent = `日志路径: /data/cloudflared/cloudflared.log | 显示: ${lines}行`;
            } catch (e) { content.textContent = `读取失败: ${e.message}`; }
        };
        
        const copyLogs = async () => {
            try {
                const lr = await runShellWithRoot(`tail -100 ${CLOUDFLARE_CONFIG.LOG_FILE} 2>/dev/null || echo "日志不存在"`);
                if (!lr.success) { ToastManager.error("无法复制日志"); return; }
                const text = lr.content || "暂无日志";
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(text);
                    ToastManager.success("日志已复制到剪贴板");
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    ToastManager.success("日志已复制到剪贴板");
                }
            } catch (e) { ToastManager.error(`复制失败: ${e.message}`); }
        };
        
        refreshBtn.addEventListener('click', loadLogs);
        copyBtn.addEventListener('click', copyLogs);
        
        loadLogs();
    };
    
    const viewLogs = async () => {
        if (!(await validateAdvancedPermission())) return;
        showLogViewer();
    };

    const showStatusViewer = () => {
        const existing = document.getElementById('CLOUDFLARE_STATUS_VIEWER');
        if (existing) { existing.remove(); }
        
        const viewer = document.createElement('div');
        viewer.id = 'CLOUDFLARE_STATUS_VIEWER';
        viewer.style.cssText = `
            position: fixed; top: 10%; left: 5%; right: 5%; bottom: 10%;
            background: #1e1e2e; border-radius: 12px; border: 1px solid #444;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 9999;
            display: flex; flex-direction: column; overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; background: #2a2a3e; border-bottom: 1px solid #444;
        `;
        
        const title = document.createElement('div');
        title.textContent = '📊 服务状态';
        title.style.cssText = 'color: #fff; font-weight: bold; font-size: 14px;';
        
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px;';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            padding: 4px 12px; background: #3b82f6; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 12px; background: #10b981; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = `
            padding: 4px 12px; background: #ef4444; color: #fff; border: none;
            border-radius: 4px; font-size: 12px; cursor: pointer;
        `;
        
        actions.appendChild(refreshBtn);
        actions.appendChild(copyBtn);
        actions.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(actions);
        
        const content = document.createElement('div');
        content.id = 'cloudflare_status_content';
        content.style.cssText = `
            flex: 1; padding: 12px; overflow-y: auto;
            font-family: 'Courier New', monospace; font-size: 12px;
            line-height: 1.6; color: #ccc; white-space: pre-wrap; word-break: break-all;
        `;
        content.textContent = '加载中...';
        
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 8px 16px; background: #2a2a3e; border-top: 1px solid #444;
            font-size: 11px; color: #888; text-align: right;
        `;
        footer.id = 'cloudflare_status_footer';
        footer.textContent = '服务状态检查';
        
        viewer.appendChild(header);
        viewer.appendChild(content);
        viewer.appendChild(footer);
        document.body.appendChild(viewer);
        
        closeBtn.addEventListener('click', () => viewer.remove());
        
        const loadStatus = async () => {
            try {
                const { running: rn, pid: rp } = await isServiceRunning(false);
                let statusText = '';
                
                if (rn) {
                    const pi = await runShellWithRoot(`ps -o etime=,pcpu=,pmem= -p ${rp} 2>/dev/null | tail -1 || echo "未知 未知 未知"`);
                    const [up = "未知", cp = "未知", mm = "未知"] = pi.success ? pi.content.trim().split(/\s+/) : ["未知", "未知", "未知"];
                    let ci = ""; const cr = await runShellWithRoot(`cat ${CLOUDFLARE_CONFIG.CONFIG_FILE} 2>/dev/null`);
                    if (cr.success && cr.content.trim()) ci = `\n\n--- config.yml ---\n${cr.content.trim()}`;
                    
                    statusText = `🟢 服务运行中\n\nPID: ${rp}\n运行时长: ${up}\nCPU占用: ${cp}%\n内存占用: ${mm}%\n运行模式: ${PLUGIN_CONFIG.mode}${ci}`;
                    title.style.color = '#10b981';
                } else {
                    const di = await diagnosisStartupFailure();
                    statusText = `🔴 服务未运行\n\n${di}`;
                    title.style.color = '#ef4444';
                }
                
                content.textContent = statusText;
                footer.textContent = `最后更新: ${new Date().toLocaleString('zh-CN')}`;
            } catch (e) { 
                content.textContent = `❌ 检查失败: ${e.message}`;
                title.style.color = '#ef4444';
            }
        };
        
        const copyStatus = () => {
            const text = content.textContent;
            if (!text || text === '加载中...') {
                ToastManager.warning("暂无状态信息可复制");
                return;
            }
            try {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                ToastManager.success("状态信息已复制到剪贴板");
            } catch (e) { ToastManager.error(`复制失败: ${e.message}`); }
        };
        
        refreshBtn.addEventListener('click', loadStatus);
        copyBtn.addEventListener('click', copyStatus);
        
        loadStatus();
    };
    
    const checkStatus = async () => {
        if (!(await validateAdvancedPermission())) return;
        showStatusViewer();
    };

    // ==================== 操作说明系统 ====================
    const GUIDES = {
        install: { title: "安装说明", content: "【功能】从GitHub下载cloudflared并安装\n【步骤】1.创建目录 2.检测下载工具 3.多镜像下载 4.设置权限 5.验证版本\n【要求】Root权限 + 网络\n【失败】显示手动安装指引" },
        start: { title: "启动说明", content: "【功能】根据模式启动隧道服务\n【步骤】1.检查安装 2.验证配置 3.生成config.yml 4.私网:注册路由 5.启动进程 6.配自启动 7.验证\n【公网需要】Token + 域名\n【私网需要】API Token + CIDR\n【须先】CF控制台创建隧道并获取Token" },
        restart: { title: "重启说明", content: "【功能】停止并重新启动服务\n【场景】改配置后/换模式后/异常时/更新Token后\n【步骤】1.杀进程 2.重写config.yml 3.重新启动" },
        status: { title: "状态说明", content: "【功能】检测进程状态\n【显示】PID/运行时长/CPU/内存/模式/config.yml\n【未运行】自动诊断: 文件/权限/配置/日志" },
        logs: { title: "日志说明", content: "【功能】读取最近100行日志\n【自动分析】Token失败/网络错误/权限不足/隧道未找到/配置错误\n【路径】/data/cloudflared/cloudflared.log" },
        uninstall: { title: "卸载说明", content: "【功能】完全卸载\n【删除】/data/cloudflared/整个目录 + 自启动配置 + 所有配置文件\n【注意】不可逆! 需双击确认" },
        mode: { title: "模式说明", content: "【公网】域名访问(https://xxx) | 需Token+域名 | 建议加Access\n【私网(WARP)】仅WARP客户端访问 | 需API Token+CIDR | 最高安全\n【双模式】公网+私网同时 | 需全部配置" },
        help: { title: "完整帮助", content: "【①CF控制台】one.dash.cloudflare.com→Tunnels→创建→复制Token→公网配Public Hostname/私网配Private Network\n【②插件】选模式→填配置→安装→启动\n【③客户端】公网:浏览器访问域名 | 私网:装WARP→登录团队→访问内网IP\n【API Token】Dashboard→资料→API令牌→创建→权限Account/Tunnel:Edit\n【WARP下载】one.one.one.one" },
        warpSetup: { title: "WARP配置指引", content: "【电脑】1.下载WARP(one.one.one.one) 2.设置→账户→Zero Trust登录 3.输团队名称 4.邮箱验证 5.访问内网IP\n【手机】1.应用商店下载1.1.1.1 2.菜单→账户→Zero Trust登录 3.输团队名称 4.切换WARP模式 5.浏览器访问内网IP\n【验证】能打开http://192.168.8.1即成功" },
    };

    const showGuide = (key) => { const g = GUIDES[key]; if (g) ToastManager.guide(g.title, g.content, 60000); };

    // ==================== 按钮工厂 ====================
    const createButton = (text, handler, needConfirm = false) => {
        const btn = Object.assign(document.createElement('button'), { className: 'btn', textContent: text });
        if (needConfirm) {
            let cc = 0, timer = null;
            const ch = () => { cc++; if (cc < 2) { ToastManager.warning(`再点一次确认${text}`); if (timer) clearTimeout(timer); timer = setTimeout(() => { cc = 0; timer = null; }, 3000); return; } if (timer) { clearTimeout(timer); timer = null; } cc = 0; btn.disabled = true; handler().finally(() => { btn.disabled = false; }); };
            btn.addEventListener('click', ch); btn._cleanup = () => { if (timer) clearTimeout(timer); btn.removeEventListener('click', ch); };
        } else {
            const ch = () => { btn.disabled = true; handler().finally(() => { btn.disabled = false; }); };
            btn.addEventListener('click', ch); btn._cleanup = () => { btn.removeEventListener('click', ch); };
        }
        return btn;
    };

    const createGuideButton = (text, key) => {
        const btn = Object.assign(document.createElement('button'), { className: 'btn guide-btn', textContent: text, style: "background:#1a1a2e;color:#0ea5e9;border:1px solid #0ea5e9;font-size:11px;padding:4px 8px;" });
        btn.addEventListener('click', () => showGuide(key)); btn._cleanup = () => { btn.removeEventListener('click', () => showGuide(key)); };
        return btn;
    };

    // ==================== UI ====================
    const createAsyncWrapper = (fn) => async () => { try { await fn(); } catch (e) { ToastManager.error(`操作失败: ${e.message}`); console.error(e); } };

    const handleModeSwitch = async () => {
        const nm = document.getElementById('tunnel_mode_select').value;
        if (nm === PLUGIN_CONFIG.mode) return;
        const { running: rn } = await isServiceRunning(false); if (rn) ToastManager.warning("切换模式前请先重启服务");
        PLUGIN_CONFIG.mode = nm; savePluginConfig(); updateModeUI();
        const lb = { 'public': '公网访问', 'private': '私网组网(WARP)', 'both': '双模式' };
        ToastManager.info(`已切换到：${lb[nm] || nm}`);
    };

    const updateModeUI = () => {
        const m = PLUGIN_CONFIG.mode;
        const ps = document.getElementById('public_config_section'); const pr = document.getElementById('private_config_section'); const ts = document.getElementById('token_config_section');
        if (m === 'public' || m === 'both') { ps.style.display = 'block'; ts.style.display = 'block'; } else { ps.style.display = 'none'; ts.style.display = 'none'; }
        if (m === 'private' || m === 'both') pr.style.display = 'block'; else pr.style.display = 'none';
    };

    const populateUIFromConfig = () => {
        document.getElementById('public_hostname_input').value = PLUGIN_CONFIG.public.hostname || '';
        document.getElementById('public_service_input').value = PLUGIN_CONFIG.public.service || 'http://127.0.0.1:80';
        document.getElementById('private_cidr_input').value = (PLUGIN_CONFIG.private.cidrList || []).join('\n');
        document.getElementById('warp_team_name_input').value = PLUGIN_CONFIG.private.teamName || '';
        document.getElementById('tunnel_mode_select').value = PLUGIN_CONFIG.mode;
    };

    const syncConfigFromUI = () => {
        PLUGIN_CONFIG.public.hostname = document.getElementById('public_hostname_input').value.trim();
        PLUGIN_CONFIG.public.service = document.getElementById('public_service_input').value.trim() || 'http://127.0.0.1:80';
        PLUGIN_CONFIG.private.cidrList = document.getElementById('private_cidr_input').value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        PLUGIN_CONFIG.private.teamName = document.getElementById('warp_team_name_input').value.trim();
        savePluginConfig();
    };

    const buttons = [
        createButton('安装 Tunnel', createAsyncWrapper(installCloudflared)),
        createButton('启动服务', createAsyncWrapper(startCloudflared)),
        createButton('重启服务', createAsyncWrapper(restartCloudflared)),
        createButton('检查状态', createAsyncWrapper(checkStatus)),
        createButton('查看日志', createAsyncWrapper(viewLogs)),
        createButton('卸载', createAsyncWrapper(uninstallCloudflared), true),
    ];

    const cleanup = () => { buttons.forEach(b => { if (b._cleanup) b._cleanup(); }); statusCache = { data: null, timestamp: 0, ttl: 5000 }; currentToken = null; cloudflaredProcessId = null; };

    const initPlugin = async () => {
        await loadPluginConfig();
        const container = document.querySelector('.functions-container');
        if (document.getElementById('CLOUDFLARE_TUNNEL')) { cleanup(); document.getElementById('CLOUDFLARE_TUNNEL').remove(); }

        const md = PLUGIN_CONFIG.mode;
        const pd = (md === 'public' || md === 'both') ? 'block' : 'none';
        const vd = (md === 'private' || md === 'both') ? 'block' : 'none';
        const td = (md === 'public' || md === 'both') ? 'block' : 'none';
        const ps = md === 'public' ? 'selected' : '';
        const vs = md === 'private' ? 'selected' : '';
        const bs = md === 'both' ? 'selected' : '';

        container.insertAdjacentHTML("afterend", `
<div id="CLOUDFLARE_TUNNEL" style="width:100%;margin-top:10px;">
<div class="title" style="margin:6px 0;color:#fff;display:flex;align-items:center;gap:15px;">
<strong style="color:#fff;">CloudFlare Tunnel 内网穿透</strong>
<div style="display:inline-block;" id="collapse_cloudflare_btn"></div></div>
<div class="collapse" id="collapse_cloudflare" data-name="close" style="height:0px;overflow:hidden;"><div class="collapse_box">
<ul class="deviceList" style="margin:0;padding:0;list-style:none;"><li style="padding:15px;">

<div style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border-left:3px solid #8b5cf6;">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
<div style="font-size:12px;color:#ccc;font-weight:500;">运行模式</div><div id="mode_guide_btn_container"></div></div>
<select id="tunnel_mode_select" style="width:100%;padding:8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:13px;box-sizing:border-box;">
<option value="public" ${ps}>公网访问模式</option>
<option value="private" ${vs}>私网组网模式 (WARP)</option>
<option value="both" ${bs}>双模式 (公网+私网)</option></select>
</div>

<div id="token_config_section" style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border-left:3px solid #0ea5e9;display:${td};">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
<div style="font-size:12px;color:#ccc;font-weight:500;">隧道 Token</div><div id="token_guide_btn_container"></div></div>
<textarea id="cloudflare_token_input" placeholder="粘贴CloudFlare Tunnel Token&#10;获取：Zero Trust → Networks → Tunnels → 创建&#10;支持：完整命令 或 直接粘贴Token" style="width:calc(100% - 2px);padding:8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;min-height:55px;resize:vertical;box-sizing:border-box;" rows="2"></textarea>
</div>

<div id="public_config_section" style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border-left:3px solid #10b981;display:${pd};">
<div style="font-size:12px;color:#ccc;font-weight:500;margin-bottom:8px;">公网配置</div>
<label style="font-size:11px;color:#aaa;">域名</label>
<input id="public_hostname_input" placeholder="f50.yourdomain.com" style="width:calc(100% - 2px);padding:6px 8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;box-sizing:border-box;margin-bottom:6px;"/>
<label style="font-size:11px;color:#aaa;">本地服务</label>
<input id="public_service_input" value="http://127.0.0.1:80" style="width:calc(100% - 2px);padding:6px 8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;box-sizing:border-box;"/>
<div style="font-size:11px;color:#888;margin-top:4px;">需在CF控制台Tunnel→Public Hostname同步配置 | 建议开启Access验证</div>
</div>

<div id="private_config_section" style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border-left:3px solid #f59e0b;display:${vd};">
<div style="font-size:12px;color:#ccc;font-weight:500;margin-bottom:8px;">私网组网配置</div>
<label style="font-size:11px;color:#aaa;">API Token</label>
<input id="cf_api_token_input" type="password" placeholder="Dashboard→资料→API令牌→创建→Account/Tunnel:Edit" style="width:calc(100% - 2px);padding:6px 8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;box-sizing:border-box;margin-bottom:6px;"/>
<label style="font-size:11px;color:#aaa;">私网CIDR (每行一个)</label>
<textarea id="private_cidr_input" placeholder="192.168.8.0/24&#10;10.0.0.0/24" style="width:calc(100% - 2px);padding:6px 8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;min-height:45px;resize:vertical;box-sizing:border-box;margin-bottom:6px;" rows="2"></textarea>
<label style="font-size:11px;color:#aaa;">WARP团队名称</label>
<input id="warp_team_name_input" placeholder="Zero Trust团队名称(客户端登录用)" style="width:calc(100% - 2px);padding:6px 8px;border:1px solid #555;border-radius:4px;background:#333;color:#fff;font-size:12px;box-sizing:border-box;margin-bottom:6px;"/>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;" id="private_guide_btns"></div>
<div style="font-size:11px;color:#888;">需在CF控制台Tunnel→Private Network同步CIDR</div>
</div>

<div style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border-left:3px solid #6366f1;">
<div style="font-size:12px;color:#ccc;font-weight:500;margin-bottom:8px;">服务控制</div>
<div id="cloudflare_action_box" style="display:flex;gap:8px;flex-wrap:wrap;"></div></div>

<div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid #a855f7;">
<div style="font-size:12px;color:#ccc;font-weight:500;margin-bottom:6px;">操作说明</div>
<div id="help_buttons_container" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div>

</li></ul></div></div></div>`);

        const fragment = document.createDocumentFragment(); buttons.forEach(b => fragment.appendChild(b));
        document.querySelector('#cloudflare_action_box').appendChild(fragment);

        const hf = document.createDocumentFragment();
        [{t:'安装说明',k:'install'},{t:'启动说明',k:'start'},{t:'重启说明',k:'restart'},{t:'状态说明',k:'status'},{t:'日志说明',k:'logs'},{t:'卸载说明',k:'uninstall'},{t:'完整帮助',k:'help'}].forEach(({t,k}) => hf.appendChild(createGuideButton(t,k)));
        document.querySelector('#help_buttons_container').appendChild(hf);

        document.querySelector('#mode_guide_btn_container').appendChild(createGuideButton('?','mode'));
        document.querySelector('#token_guide_btn_container').appendChild(createGuideButton('Token帮助','start'));
        const pg = document.querySelector('#private_guide_btns'); if (pg) { pg.appendChild(createGuideButton('WARP指引','warpSetup')); pg.appendChild(createGuideButton('API Token指引','start')); }

        populateUIFromConfig();
        document.getElementById('tunnel_mode_select').addEventListener('change', handleModeSwitch);
        ['public_hostname_input','public_service_input','private_cidr_input','warp_team_name_input','cf_api_token_input'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', syncConfigFromUI); });
        updateModeUI();
        collapseGen("#collapse_cloudflare_btn", "#collapse_cloudflare", "#collapse_cloudflare", () => {});
        window.addEventListener('beforeunload', cleanup);
    };

    (() => { initPlugin(); })();
})();
//</script>
