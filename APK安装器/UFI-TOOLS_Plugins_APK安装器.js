//<script>
(async () => {
    // ---------- 插件基本信息 ----------
    const PLUGIN_NAME = "APKInstaller";
    const PLUGIN_CN_NAME = "APK安装器";
    const PLUGIN_ID = "apk_installer_kano";

    // ---------- 全局辅助函数 ----------
    const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

    // 带重试的 fetch：针对瞬时网络错误（502/503/504）或网络抖动进行重试
    const fetchWithRetry = async (url, options, retries = 2, baseDelayMs = 400) => {
        const isTransient = (status) => status === 502 || status === 503 || status === 504;
        let lastErr = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(url, options);
                if (res.ok || !isTransient(res.status)) {
                    return res;
                }
                lastErr = new Error(`HTTP ${res.status}`);
            } catch (err) {
                lastErr = err;
            }
            if (attempt < retries) {
                const delay = baseDelayMs * (attempt + 1); // 400ms, 800ms
                console.warn(`上传失败（第 ${attempt + 1} 次），${delay}ms 后重试...`, lastErr?.message);
                await wait(delay);
            }
        }
        throw lastErr || new Error("上传失败");
    };

    // 使用 root 权限检查是否为 Android 环境
    const isAndroidEnvironment = async () => {
        try {
            // 通过 root 执行 getprop，获取 SDK 版本号
            const res = await runShellWithRoot("getprop ro.build.version.sdk", 5000);
            if (res.success && res.content && res.content.trim().match(/^\d+$/)) {
                return true;
            }
            // 备用：获取制造商
            const res2 = await runShellWithRoot("getprop ro.product.manufacturer", 5000);
            if (res2.success && res2.content && res2.content.trim().length > 0) {
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    // 检查高级功能（Root权限）
    const checkAdvancedFunc = async () => {
        const res = await runShellWithRoot("whoami");
        if (res && res.success && res.content && res.content.includes("root")) {
            return true;
        }
        return false;
    };

    // 获取所有第三方应用（仅包名）
    const fetchAllApps = async (onProgress) => {
        const pkgRes = await runShellWithRoot(`pm list packages -3 | sed 's/^package://'`, 30000);
        if (!pkgRes.success) {
            throw new Error("获取应用列表失败: " + (pkgRes.content || "未知错误"));
        }
        const packages = pkgRes.content.split(/\r?\n/).filter(p => p.trim().length > 0);
        if (packages.length === 0) {
            return [];
        }

        const apps = [];
        let processed = 0;
        const total = packages.length;

        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            apps.push({ packageName: pkg });
            processed++;
            if (onProgress) {
                onProgress(processed, total, pkg);
            }
            await wait(30);
        }
        return apps;
    };

    // 卸载应用
    const uninstallApp = async (packageName) => {
        const confirmMsg = `确认卸载 ${packageName} 吗？\n卸载后应用数据将被清除。`;
        if (!confirm(confirmMsg)) return false;
        const res = await runShellWithRoot(`pm uninstall ${packageName}`, 30000);
        if (res.success && (res.content.includes("Success") || res.content.includes("成功"))) {
            createToast(`已卸载: ${packageName}`, "green");
            return true;
        } else {
            createToast(`卸载失败: ${packageName}\n${res.content || "未知错误"}`, "red");
            return false;
        }
    };

    // 安装 APK（上传并安装）
    const installApk = async (file) => {
        if (!file || !file.name.endsWith(".apk")) {
            createToast("请选择一个有效的 .apk 文件", "red");
            return false;
        }
        const formData = new FormData();
        formData.append("file", file);
        let destPath = "";
        try {
            const uploadRes = await fetchWithRetry(`${KANO_baseURL}/upload_img`, {
                method: "POST",
                headers: common_headers,
                body: formData,
            });
            const json = await uploadRes.json();
            if (!json.url) {
                throw new Error(json.error || "上传失败");
            }
            // 路径安全校验：url 必须是 app 数据目录下的普通文件，防止 ../ 逃逸
            const uploaded = String(json.url);
            if (!uploaded.startsWith("/")) {
                throw new Error("上传返回路径异常");
            }
            const cleanUrl = uploaded.replace(/\/+/g, "/").replace(/\.\.\//g, "");
            const tempPath = `/data/data/com.minikano.f50_sms/files${cleanUrl}`;
            destPath = `/data/local/tmp/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const moveRes = await runShellWithRoot(`mv ${tempPath} ${destPath} && chmod 644 ${destPath}`, 10000);
            if (!moveRes.success) {
                throw new Error("移动文件失败");
            }
            createToast("正在安装 APK，请稍候...", "pink");
            // -r 覆盖安装，-d 允许版本降级
            const installRes = await runShellWithRoot(`pm install -r -d ${destPath}`, 120000);
            if (installRes.success && (installRes.content.includes("Success") || installRes.content.includes("成功"))) {
                createToast("安装成功！", "green");
                return true;
            } else {
                createToast(`安装失败: ${installRes.content || "未知错误"}`, "red");
                return false;
            }
        } catch (err) {
            console.error(err);
            createToast(`安装出错: ${err.message || "未知错误"}`, "red");
            return false;
        } finally {
            // 无论成功失败都清理临时文件，避免残留
            if (destPath) {
                await runShellWithRoot(`rm -f ${destPath}`, 5000);
            }
        }
    };

    // ---------- 页面渲染与分页 ----------
    let currentApps = [];        // 所有应用列表 [{ packageName }]
    let currentPage = 1;
    const PAGE_SIZE = 10;

    const renderAppList = (page) => {
        const container = document.getElementById(`${PLUGIN_ID}_list_container`);
        if (!container) return;
        const start = (page - 1) * PAGE_SIZE;
        const pageApps = currentApps.slice(start, start + PAGE_SIZE);
        const totalPages = Math.ceil(currentApps.length / PAGE_SIZE);

        // 如果当前页无数据且不是第一页，自动跳转到最后一页
        if (pageApps.length === 0 && currentApps.length > 0 && page > 1) {
            currentPage = totalPages;
            renderAppList(currentPage);
            return;
        }

        let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.75rem;">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.2);">
            <th style="padding:8px 4px;text-align:left;">应用包名</th>
            <th style="padding:8px 4px;width:70px;text-align:center;">操作</th>
        </tr></thead><tbody>`;

        for (const app of pageApps) {
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                <td style="padding:8px 4px;word-break:break-all;color:#fff;">${escapeHtml(app.packageName)}</td>
                <td style="padding:8px 4px;text-align:center;"><button class="apk-uninstall-btn" data-pkg="${escapeHtml(app.packageName)}" style="background:#e34d4d;border:none;border-radius:6px;padding:4px 8px;color:white;font-size:0.65rem;cursor:pointer;">卸载</button></td>
             </tr>`;
        }
        html += `</tbody>${'</table>'}</div>`;

        // 分页控件（不包含刷新按钮）
        let paginationHtml = `<div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:15px;flex-wrap:wrap;">
            <button id="${PLUGIN_ID}_prev_page" class="btn" style="padding:4px 12px;" ${currentPage === 1 || totalPages === 0 ? 'disabled' : ''}>上一页</button>
            <span style="font-size:0.7rem;">第 ${currentPage} / ${totalPages || 1} 页 (共 ${currentApps.length} 个应用)</span>
            <button id="${PLUGIN_ID}_next_page" class="btn" style="padding:4px 12px;" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>下一页</button>
        </div>`;
        container.innerHTML = html + paginationHtml;

        // 绑定卸载按钮事件
        document.querySelectorAll('.apk-uninstall-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const pkg = btn.getAttribute('data-pkg');
                if (!pkg) return;
                const success = await uninstallApp(pkg);
                if (success) {
                    await loadAndDisplayApps(true);
                }
            });
        });

        // 分页按钮事件
        const prevBtn = document.getElementById(`${PLUGIN_ID}_prev_page`);
        const nextBtn = document.getElementById(`${PLUGIN_ID}_next_page`);
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderAppList(currentPage);
                }
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderAppList(currentPage);
                }
            };
        }
    };

    // 加载应用并刷新列表（带进度提示）
    const loadAndDisplayApps = async (showToastMsg = false) => {
        const statusSpan = document.getElementById(`${PLUGIN_ID}_status`);
        if (statusSpan) statusSpan.textContent = `${PLUGIN_CN_NAME} - 🔄 加载中...`;

        let progressToast = null;
        let lastProgress = -1;
        const updateProgress = (current, total, pkg) => {
            const percent = Math.floor((current / total) * 100);
            if (percent !== lastProgress) {
                lastProgress = percent;
                if (progressToast) {
                    progressToast.el.querySelector('pre').innerHTML = `正在扫描应用 (${current}/${total}):<br>${escapeHtml(pkg)}<br>${percent}%`;
                }
            }
        };

        try {
            const { close } = createFixedToast(`${PLUGIN_ID}_load_progress`, `<pre style="white-space: pre-wrap;min-width:280px;text-align: center;">正在扫描第三方应用...<br>请稍候</pre>`, '');
            progressToast = { el: document.querySelector(`#${PLUGIN_ID}_load_progress`), close };
            currentApps = await fetchAllApps(updateProgress);
            close();
            if (currentApps.length === 0) {
                createToast("未检测到第三方应用", "pink");
            }
            currentPage = 1;
            renderAppList(1);
            if (statusSpan) statusSpan.textContent = `${PLUGIN_CN_NAME} - 🟢 就绪 (${currentApps.length} 个应用)`;
            if (showToastMsg) createToast(`已刷新，共 ${currentApps.length} 个第三方应用`, "green");
        } catch (err) {
            console.error(err);
            if (progressToast && progressToast.close) progressToast.close();
            createToast(`加载失败: ${err.message}`, "red");
            if (statusSpan) statusSpan.textContent = `${PLUGIN_CN_NAME} - 🔴 加载失败`;
            currentApps = [];
            renderAppList(1);
        }
    };

    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    };

    // ---------- 环境检查：必须使用 root 检测 Android ----------
    let hasRoot = false;
    try {
        hasRoot = await checkAdvancedFunc();
        if (!hasRoot) {
            createToast("未开启高级功能（root），无法检测系统环境，插件将不会加载。", "red", 5000);
            return;
        }
    } catch (e) {
        createToast("获取 root 权限失败，插件无法运行。", "red", 5000);
        return;
    }

    const isAndroid = await isAndroidEnvironment();
    if (!isAndroid) {
        createToast("当前系统不是 Android 或无法获取 Android 属性，插件不支持。", "red", 5000);
        const container = document.querySelector('.functions-container');
        if (container) {
            const warnDiv = document.createElement('div');
            warnDiv.style.cssText = "background:#ff9800;color:#000;padding:8px;margin:10px 0;border-radius:8px;text-align:center;font-size:0.8rem;";
            warnDiv.innerHTML = "⚠️ APK安装器插件仅支持 Android 系统，当前环境不兼容。";
            container.insertAdjacentElement('afterend', warnDiv);
        }
        return;
    }

    // ---------- 插入UI (与 ws_scrcpy 风格一致) ----------
    while (!window.UFI_DATA || !UFI_DATA.lan_ipaddr) {
        await wait(200);
    }

    const container = document.querySelector('.functions-container');
    if (!container) {
        console.error("未找到 .functions-container，无法插入APK安装器");
        return;
    }

    container.insertAdjacentHTML("afterend", `
<div id="${PLUGIN_ID}_wrapper" style="width:100%; margin-top: 10px;">
    <div class="title" style="margin: 6px 0;">
        <strong id="${PLUGIN_ID}_status">${PLUGIN_CN_NAME} - 🔍 初始化</strong>
        <div style="display: inline-block;" id="collapse_${PLUGIN_ID}_btn"></div>
    </div>
    <div class="collapse" id="collapse_${PLUGIN_ID}" data-name="close" style="height: 0px; overflow: hidden;">
        <div class="collapse_box">
            <div style="margin-bottom: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button id="${PLUGIN_ID}_install_apk_btn" class="btn">📲 安装 APK</button>
                <button id="${PLUGIN_ID}_refresh_btn" class="btn">🔄 刷新列表</button>
                <span style="font-size:0.7rem; opacity:0.7;">✓ 已获取 Root 权限</span>
            </div>
            <div id="${PLUGIN_ID}_list_container" style="min-height: 200px;">
                <div style="text-align:center;padding:20px;">点击标题展开后自动加载应用列表</div>
            </div>
        </div>
    </div>
</div>
    `);

    // 初始化折叠控件（使用 UFI-TOOLS 内置 collapseGen）
    if (typeof collapseGen === 'function') {
        collapseGen(`#collapse_${PLUGIN_ID}_btn`, `#collapse_${PLUGIN_ID}`, `#collapse_${PLUGIN_ID}`, (state) => {
            if (state === 'open') {
                if (currentApps.length === 0) {
                    loadAndDisplayApps(false);
                } else {
                    renderAppList(currentPage);
                }
            }
        });
    } else {
        console.warn("collapseGen 未定义，折叠功能不可用，手动绑定简单展开");
        const btn = document.querySelector(`#collapse_${PLUGIN_ID}_btn`);
        const collapseDiv = document.querySelector(`#collapse_${PLUGIN_ID}`);
        if (btn && collapseDiv) {
            btn.style.cursor = "pointer";
            btn.onclick = () => {
                if (collapseDiv.style.height === "0px" || collapseDiv.style.height === "0") {
                    collapseDiv.style.height = "auto";
                    collapseDiv.setAttribute("data-name", "open");
                    if (currentApps.length === 0) loadAndDisplayApps(false);
                    else renderAppList(currentPage);
                } else {
                    collapseDiv.style.height = "0px";
                    collapseDiv.setAttribute("data-name", "close");
                }
            };
        }
    }

    // 安装 APK 按钮
    const installBtn = document.getElementById(`${PLUGIN_ID}_install_apk_btn`);
    if (installBtn) {
        installBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.apk,application/vnd.android.package-archive';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const success = await installApk(file);
                if (success) {
                    await loadAndDisplayApps(true);
                }
                input.remove();
            };
            input.style.position = 'fixed';
            input.style.left = '-999px';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.click();
        };
    }

    // 刷新列表按钮（顶部）
    const refreshBtn = document.getElementById(`${PLUGIN_ID}_refresh_btn`);
    if (refreshBtn) {
        refreshBtn.onclick = () => loadAndDisplayApps(true);
    }

    // 如果 collapse 默认是打开状态（本地存储可能记录），则自动加载
    const storedState = localStorage.getItem(`#collapse_${PLUGIN_ID}`);
    if (storedState === 'open') {
        await wait(300);
        loadAndDisplayApps(false);
    }
})();
//</script>
