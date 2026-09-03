//<script>
(() => {
  const checkAdvanceFunc = async () => {
    const res = await runShellWithRoot('whoami');
    if (res.content) {
      if (res.content.includes('root')) {
        return true;
      }
    }
    return false;
  };

  //创建随机数
  const createRandomString = (length = 8) => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  };

  const isMMRunning = async () => {
    const status = await runShellWithRoot('pgrep Clash');
    const running_mm = document.querySelector('#running_mm');
    const isR =
      status.content != null &&
      status.content != undefined &&
      status.content != '';
    if (running_mm) {
      running_mm.innerHTML = isR ? '猫猫 - 🟢运行中' : '猫猫 - 🔴已停止';
    }
    return isR;
  };

  async function isELF(file) {
    const blob = file.slice(0, 4); // 前4字节
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    return (
      bytes[0] === 0x7f &&
      bytes[1] === 0x45 &&
      bytes[2] === 0x4c &&
      bytes[3] === 0x46
    );
  }

  const askConfirm = (id, title, body, ok = '确认', cancel = '取消') => new Promise((resolve) => {
    const { el, close } = createFixedToast(
      id,
      `<div style="pointer-events:all;width:90vw;max-width:520px;">
        <div class="title" style="margin:0">${title}</div>
        <div style="margin-top:10px;font-size:.7rem;line-height:1.75">${body}</div>
        <div style="margin-top:14px;text-align:right;display:flex;justify-content:flex-end;gap:10px;">
          <button class="ok">${ok}</button>
          <button class="cancel">${cancel}</button>
        </div>
      </div>`,
    );
    const done = (value) => {
      close();
      resolve(value);
    };
    el.querySelector('.ok')?.addEventListener('click', () => done(true));
    el.querySelector('.cancel')?.addEventListener('click', () => done(false));
  });

  // 检测是否开机自启
  const checkIsBootUp = async () => {
    const res = await runShellWithRoot(`
        grep -q '/data/clash/Scripts/Clash.Service start' /sdcard/ufi_tools_boot.sh
        echo $?
        `);
    return res.content.trim() == '0';
  };

  //监测是否已经安装过了
  const checkIsInstalled = async () => {
    const res = await runShellWithRoot(`
        ls /data/clash/Scripts/Clash.Service
        `);
    return res.success && res.content && res.content.includes('Clash.Service');
  };

  const saveConfig = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await (
        await fetch(`${KANO_baseURL}/upload_img`, {
          method: 'POST',
          headers: common_headers,
          body: formData,
        })
      ).json();

      if (res.url) {
        let foundFile = await runShellWithRoot(`
                        ls /data/data/com.minikano.f50_sms/files/${res.url}
                    `);
        if (!foundFile.content) {
          throw '上传失败';
        }
        let resShell = await runShellWithRoot(`
                        mv  /data/data/com.minikano.f50_sms/files/${res.url} /data/clash/Proxy/config.yaml
                    `);
        if (resShell.success) {
          createToast(`上传成功！正在重启核心...`, 'green');
          btn_restart.click();
          return true;
        }
      } else throw res.error || '';
    } catch (e) {
      console.error(e);
      createToast(`上传失败!`, 'red');
      return false;
    }
  };

  const showDialog = (message, title = '提示') => {
    let timer = null;
    const containerId = 'toast_' + createRandomString(4);
    const id = 'close_message_btn_' + createRandomString(4);
    const id_download = 'download_btn_' + createRandomString(4);
    const id_clear = 'clear_btn_' + createRandomString(4);
    const id_refresh = 'clear_btn_' + createRandomString(4);
    const id_pause = 'pause_btn_' + createRandomString(4);
    const message1 = message.replaceAll('\n', '<br>');
    const { el, close } = createFixedToast(
      containerId,
      `
        <div style="pointer-events:all;width:80vw;max-width:800px">
            <div class="title" style="margin:0" data-i18n="system_notice">${title}</div>
            <div class="content_message" style="background: rgba(0, 0, 0, 0.8);color: rgb(0, 255, 0);box-sizing: border-box;font-family: sans-serif;line-height:1.4;margin:10px 0;max-height: 400px;overflow: auto;font-size: .64rem;">${message1}</div>
            <div style="text-align:right">
                <button style="font-size:.64rem" id="${id}" data-i18n="close_btn">${t('close_btn')}</button>
                <button style="font-size:.64rem" id="${id_download}" data-i18n="only_download">${t('only_download')}</button>
                <button style="font-size:.64rem;background:var(--dark-btn-color-active)" id="${id_pause}">自动滚动</button>
                <button style="font-size:.64rem" id="${id_refresh}">刷新</button>
                <button style="font-size:.64rem" id="${id_clear}">清空日志</button>
            </div>
        </div>
        `,
    );
    const btn = el.querySelector(`#${id}`);
    const download = el.querySelector(`#${id_download}`);
    const clearBtn = el.querySelector(`#${id_clear}`);
    const rBtn = el.querySelector(`#${id_refresh}`);
    const msg_el = el.querySelector(`.content_message`);

    if (!btn) {
      close();
      if (timer) timer();
      return;
    }

    let shouldPause = false;
    let fnfn = requestInterval(() => {
      if (msg_el && !shouldPause) {
        msg_el.scrollTo({
          top: msg_el.scrollHeight + 199,
          left: 0,
          behavior: 'smooth',
        });
      }
    }, 500);

    if (download) {
      download.onclick = async () => {
        const t = Math.floor(Date.now() + Math.random());
        const file = new File([message1.replaceAll('<br>', '\n')], {
          type: 'text/plain',
        });
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.download = `kano_mm_log_${t}.txt`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      };
    }

    if (clearBtn) {
      clearBtn.onclick = async () => {
        const res = await runShellWithRoot(
          `echo "" > /sdcard/Clash内核日志.txt`,
        );
        if (res.success) {
          createToast('日志已清空', 'green');
          close();
          if (timer) timer();
          fnfn && fnfn();
        } else {
          createToast(`清空日志失败`, 'red');
        }
      };
    }

    const refresh = async (flag = false) => {
      const msg_el = el.querySelector(`.content_message`);
      const res = await runShellWithRoot(
        `timeout 2s awk \'{print}\' /sdcard/Clash内核日志.txt | tail -n 100`,
      );
      if (res.success) {
        msg_el.innerHTML = res.content.replaceAll('\n', '<br>');
        flag && createToast('日志已刷新');
      } else {
        flag && createToast('获取日志失败', 'red');
      }
    };

    if (rBtn) {
      rBtn.onclick = async () => {
        await refresh(true);
      };
    }

    if (timer) timer();
    timer = requestInterval(async () => {
      await refresh();
    }, 1000);

    btn.onclick = async () => {
      if (timer) timer();
      close();
      fnfn && fnfn();
    };

    const pause_btn = el.querySelector(`#${id_pause}`);
    if (pause_btn) {
      pause_btn.dataset.paused = '1';
      pause_btn.onclick = () => {
        if (pause_btn.dataset.paused != '1') {
          pause_btn.dataset.paused = '1';
          pause_btn.style.background = 'var(--dark-btn-color-active)';
          shouldPause = false;
        } else {
          pause_btn.dataset.paused = '0';
          pause_btn.style.background = '';
          shouldPause = true;
        }
      };
    }
  };

  const btn_enabled = document.createElement('button');
  btn_enabled.textContent = '安装';
  let disabled_btn_enabled = false;
  btn_enabled.onclick = async (e) => {
    if (disabled_btn_enabled) return;
    disabled_btn_enabled = true;
    try {
      if (!(await checkAdvanceFunc())) {
        disabled_btn_enabled = false;
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (await checkIsInstalled()) {
        disabled_btn_enabled = false;
        createToast('已经安装过猫猫了！', 'red');
        return;
      }

      createToast('下载所需组件中...');
      const res0 = await runShellWithRoot(
        `/data/data/com.minikano.f50_sms/files/curl -L "https://pan.kanokano.cn/d/UFI-TOOLS-UPDATE/plugins/mihomo-tproxy.zip" -o /data/kano_clash.zip --output /data/kano_clash.zip --write-out "DOWNLOAD_DONE\nTotal: %{size_download} bytes\nSpeed: %{speed_download} B/s\nTime: %{time_total} sec\n" > /data/kano_mihomo_latest.dlog 2>&1 &`,
        100 * 1000,
      );
      if (!res0.success) {
        btn_enabled.disabled = false;
        return createToast('下载依赖失败!', 'red');
      }

      let log = '';
      const max_times = 600; // 最多等待10分钟
      let count_times = 0;
      const { el, close } = createFixedToast(
        'kano_mihomo_toast',
        `<pre style="white-space: pre-wrap;min-width:300px;text-align: center;">等待日志中...</pre>`,
        '',
      );

      const interval = setInterval(async () => {
        const dlog = await runShellWithRoot(
          "timeout 2s  awk '{print}' /data/kano_mihomo_latest.dlog",
        );
        const lines = dlog.content.split('\n'); // 按换行符拆分成数组
        log = lines.slice(-6).join('\n');
        el.innerHTML = `<pre style="white-space: pre-wrap;min-width:300px;text-align: center;">${log.replaceAll('\n', '<br>')}</pre>`;
        if (log.includes('DOWNLOAD_DONE')) {
          setTimeout(() => {
            close();
          }, 2000);
        }
      }, 1000);

      while (true) {
        if (max_times <= count_times) {
          clearInterval(interval);
          btn_enabled.disabled = false;
          return ('下载超时，请检查网络连接或稍后重试！', 'red');
        }
        if (log.includes('DOWNLOAD_DONE')) {
          clearInterval(interval);
          break;
        }
        count_times++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await runShellWithRoot('rm -f /data/kano_mihomo_latest.dlog');

      createToast('解压猫猫文件...');
      const res2 = await runShellWithRoot(`
        cd /data/
        mkdir -p clash
        unzip kano_clash.zip -d /data/clash/
        `);
      if (!res2.success) return createToast('解压猫猫文件出错!', 'red');

      // 注入自定义规则合并逻辑（适配新版 Go 内核 clashctl，不依赖 main.sh/vi_yaml.sh）
      await runShellWithRoot(`
        cat > /data/clash/Scripts/merge_custom_rules.sh << 'MERGESHEOF'
#!/system/bin/sh
# 自定义规则合并脚本（适配新版 Go 内核 clashctl，4 空格缩进 config.yaml）
# 独立可执行，不依赖 main.sh/vi_yaml.sh。每次内核启动前由 Clash.Service 调用。
# 注意：此脚本被 source 时只能用 return，直接执行时用 exit。

Module_dir=/data/clash
CLASH_CONFIG="$Module_dir/Proxy/config.yaml"
yq_path="$Module_dir/Tools/yq_linux_arm64"

CUSTOM_RULES_FILE="$Module_dir/Proxy/custom_rules.yaml"
COUNTER_FILE="$Module_dir/Proxy/.custom_rules_count"
CFG="$CLASH_CONFIG"

# 步骤1：删除上次合并的 PREV 条规则（文本级 awk 操作，兼容任意空格缩进）
if [ -f "$COUNTER_FILE" ]; then
    PREV=$(cat "$COUNTER_FILE" 2>/dev/null)
    if [ -n "$PREV" ] && [ "$PREV" -gt 0 ] 2>/dev/null; then
        awk -v n="$PREV" '
          /^rules:/   { in_rules=1; print; next }
          in_rules && /^[[:space:]]*- / { if (++cnt <= n) next }
          in_rules && !/^[[:space:]]*- / && !/^[[:space:]]*$/ { in_rules=0 }
          { print }
        ' "$CFG" > "$CFG.tmp" 2>/dev/null && mv "$CFG.tmp" "$CFG"
    fi
fi

if [ ! -f "$CUSTOM_RULES_FILE" ] || [ ! -s "$CUSTOM_RULES_FILE" ]; then
    rm -f "$COUNTER_FILE"
    return 0 2>/dev/null || exit 0
fi

# 步骤2：用 sed r 命令在 rules: 后插入规则（适配 4 空格缩进）
grep -v '^\\s*#' "$CUSTOM_RULES_FILE" | grep -v '^\\s*$' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^/    - /' > "$CFG.tmp_rules" 2>/dev/null

COUNT=$(wc -l < "$CFG.tmp_rules" 2>/dev/null || echo 0)
if [ "$COUNT" -eq 0 ]; then
    rm -f "$COUNTER_FILE" "$CFG.tmp_rules"
    return 0 2>/dev/null || exit 0
fi

sed -i '/^rules:/r '"$CFG.tmp_rules" "$CFG" 2>/dev/null
rm -f "$CFG.tmp_rules"
echo "$COUNT" > "$COUNTER_FILE"

return 0 2>/dev/null || exit 0
MERGESHEOF
        chmod 755 /data/clash/Scripts/merge_custom_rules.sh
        # 新版 Go 内核没有 main.sh，改为在 Clash.Service 的 start 前合并规则（整体重写，避免转义问题）
        grep -q 'merge_custom_rules' /data/clash/Scripts/Clash.Service || \
          cat > /data/clash/Scripts/Clash.Service << 'EOSERVEOF'
#!/system/bin/sh
# 兼容旧入口；配置、订阅、YAML 与启停逻辑均由 Go 程序执行。
case "$(getprop ro.product.cpu.abi 2>/dev/null)" in
  arm64-v8a) binary=/data/clash/Scripts/clashctl_arm64 ;;
  armeabi-v7a|armeabi) binary=/data/clash/Scripts/clashctl_armv7 ;;
  *) binary=/data/clash/Scripts/clashctl ;;
esac

if [ ! -x "$binary" ]; then
  echo "找不到适用于当前架构的 clashctl: $binary"
  exit 1
fi

# 启动前合并自定义规则（适配新版 Go 内核，不依赖 main.sh）
if [ "$1" = "start" ]; then
  [ -f /data/clash/Scripts/merge_custom_rules.sh ] && \
    sh /data/clash/Scripts/merge_custom_rules.sh
fi

exec "$binary" "$@"
EOSERVEOF
        chmod 755 /data/clash/Scripts/Clash.Service
      `);

      createToast('检查依赖文件，可能需要一点时间...');
      const res3 = await runShellWithRoot(`
        ls /data/clash/Scripts
        `);
      if (!res3.success || !res3.content.includes('Clash.Service'))
        return createToast('检查猫猫依赖文件失败!', 'red');

      createToast('正在安装猫猫，设置Clash自启动...');
      const res5 = await runShellWithRoot(`
chmod 777 -Rf /data/clash
grep -qxF '/data/clash/Scripts/Clash.Service start' /sdcard/ufi_tools_boot.sh || echo '/data/clash/Scripts/Clash.Service start' >> /sdcard/ufi_tools_boot.sh
grep -qxF 'inotifyd /data/clash/Scripts/Clash.Inotify "/data/clash/Clash" >> /dev/null &' /sdcard/ufi_tools_boot.sh || echo 'inotifyd /data/clash/Scripts/Clash.Inotify "/data/clash/Clash" >> /dev/null &' >> /sdcard/ufi_tools_boot.sh
        `);
      if (!res5.success) return createToast('设置猫猫自启动失败!', 'red');

      createToast('启动Clash...');
      const res6 = await runShellWithRoot(`
        /data/clash/Scripts/Clash.Service start
        `);
      if (!res6.success) return createToast('启动猫猫失败!', 'red');

      disabled_btn_enabled = false;

      checkIsBootUp().then((isBootUp) => {
        const boot_on = document.querySelector('#clash_boot_on');
        if (!boot_on) return;
        if (isBootUp) {
          boot_on.style.background = 'var(--dark-btn-color-active)';
        } else {
          boot_on.style.background = '';
        }
      });
      setTimeout(() => {
        isMMRunning();
      }, 3000);

      await askConfirm(
        'mm_installed_confirm_1',
        '启动Clash成功',
        `web地址(端口默认是7788)<br />
        <a href="http://${UFI_DATA.lan_ipaddr}:7788/ui/" target="_blank">http://${UFI_DATA.lan_ipaddr}:7788/ui/</a><br />
        主机地址填:${UFI_DATA.lan_ipaddr}<br />
        密码默认为123456<br />
        端口填7788<br />
        第一次使用请点击编辑配置，按照说明操作，不然核心无法启动！<br />
        依赖文件路径:/data/clash/<br/>
        内核日志:sdcard/Clash内核日志.txt<br/>
        输出:${res6.content}`,
        'OK',
      );
    } finally {
      disabled_btn_enabled = false;
      await runShellWithRoot(`rm -f /data/kano_clash.zip`);
    }
  };
  const btn_disabled = document.createElement('button');
  btn_disabled.textContent = '卸载';
  let ct = 0;
  let tmer = null;
  btn_disabled.onclick = async () => {
    if (!(await checkAdvanceFunc())) {
      createToast('没有开启高级功能，无法使用！', 'red');
      return;
    }
    ct++;
    tmer && clearTimeout(tmer);
    tmer = setTimeout(() => {
      ct = 0;
    }, 3000);
    if (ct < 3) {
      return createToast('再点一次卸载猫猫');
    }
    createToast('卸载中...', 'red');
    const res = await runShellWithRoot(`
        /data/clash/Scripts/Clash.Service stop
        sleep 1
        rm -rf /data/clash
        sed -i '/Clash.Service/d' /sdcard/ufi_tools_boot.sh
        sed -i '/Clash.Inotify/d' /sdcard/ufi_tools_boot.sh
        `);
    if (!res.success) return createToast('卸载失败！', 'red');
    createToast(`<div style="width:300px;text-align:center">
        卸载结果：${res.content}<br/>
        如果没有错误即视为卸载成功
        </div>`);
    await isMMRunning();
  };

  const btn_restart = document.createElement('button');
  btn_restart.textContent = '重启';
  btn_restart.onclick = async () => {
    if (!(await checkAdvanceFunc())) {
      createToast('没有开启高级功能，无法使用！', 'red');
      return;
    }
    if (!(await checkIsInstalled())) {
      createToast('没有安装猫猫，请先安装！', 'red');
      return;
    }
    createToast(
      '重启猫猫中...<br/>如果等待时间比较久，请持续观察日志。',
      'green',
    );
    const res = await runShellWithRoot(
      `
        /data/clash/Scripts/Clash.Service stop
        sleep 1
        /data/clash/Scripts/Clash.Service start
        `,
      100 * 1000,
    );
    if (!res.success) return createToast('重启失败！', 'red');
    createToast(
      `<div style="width:300px;text-align:center">
            ${res.content.replaceAll('\n', '<br/>')}
        </div>`,
      'green',
    );
    await isMMRunning();
  };

  //一键上传
  const uploadEl = document.createElement('input');
  uploadEl.type = 'file';
  uploadEl.onchange = async (e) => {
    if (!e?.target?.files) return;
    const file = e.target.files[0];
    if (file) {
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      await runShellWithRoot(`
                        rm /data/data/com.minikano.f50_sms/files/uploads/clash_config.yml
                    `);
      // 检查文件大小
      if (file.size > 1 * 1024 * 1024) {
        createToast(`文件大小不能超过${1}MB！`, 'red');
      } else {
        try {
          await saveConfig(file);
        } finally {
          uploadEl.value = '';
        }
      }
    }
  };

  const editBtn = document.createElement('button');
  editBtn.classList.add('btn');
  editBtn.textContent = '编辑配置';
  editBtn.onclick = async () => {
    if (!(await checkAdvanceFunc())) {
      createToast('没有开启高级功能，无法使用！', 'red');
      return;
    }
    if (!(await checkIsInstalled())) {
      createToast('没有安装猫猫，请先安装！', 'red');
      return;
    }
    const res = await runShellWithRoot(`
        timeout 5s  awk '{print}' /data/clash/Proxy/config.yaml
        `);
    if (!res.success) return createToast('备份失败！', 'red');

    const { el, close } = createFixedToast(
      'kano_eidt_mm_message',
      `
                <div style="pointer-events:all;width:80vw;max-width:800px;">
                    <div class="title" style="margin:0" data-i18n="system_notice">编辑 YAML</div>
                    <div style="margin:10px 0" class="inner"></div>
                    <div style="text-align:right">
                        <button style="font-size:.64rem" id="save_eidt_mm_message_btn" data-i18n="plugin_modal_submit_btn">${t('plugin_modal_submit_btn')}</button>
                        <button style="font-size:.64rem" id="close_eidt_mm_message_btn" data-i18n="close_btn">${t('close_btn')}</button>
                    </div>
                </div>
                `,
    );

    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '500px';
    textarea.style.maxHeight = '60vh';
    textarea.style.border = 'none';
    textarea.style.background = '#000000cc';
    textarea.style.color = '#0f0';
    textarea.style.boxSizing = 'border-box';
    textarea.style.fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif';
    textarea.style.lineHeight = '1.4';
    textarea.value = res.content;
    el.querySelector('.inner').appendChild(textarea);
    const btn = el.querySelector('#close_eidt_mm_message_btn');
    const sbtn = el.querySelector('#save_eidt_mm_message_btn');
    if (!btn) {
      close();
      return;
    }
    btn.onclick = async () => {
      close();
    };
    sbtn.onclick = async () => {
      const v = textarea.value;
      if (!v || v.trim().length == 0) {
        return createToast('配置不能为空！', 'red');
      }
      createToast('正在保存...', '');
      const file = new File([v], 'config.yaml', { type: 'text/plain' });
      if (!(await saveConfig(file))) {
        return;
      }
      close();
    };
  };

  const uploadBtn = document.createElement('button');
  uploadBtn.classList.add('btn');
  uploadBtn.textContent = '上传配置';
  uploadBtn.onclick = async () => {
    if (!(await checkIsInstalled())) {
      createToast('没有安装猫猫，请先安装！', 'red');
      return;
    }
    uploadEl.click();
  };

  const stopBtn = document.createElement('button');
  stopBtn.classList.add('btn');
  stopBtn.textContent = '停止';
  stopBtn.onclick = async () => {
    if (!(await checkAdvanceFunc())) {
      createToast('没有开启高级功能，无法使用！', 'red');
      return;
    }
    createToast('干掉猫猫中...', 'green');
    const res = await runShellWithRoot(`
        /data/clash/Scripts/Clash.Service stop
        sleep 1
        `);
    if (!res.success) return createToast('停止失败！', 'red');
    createToast(
      `<div style="width:300px;text-align:center">
            ${res.content.replaceAll('\n', '<br/>')}
        </div>`,
      'green',
    );
    await isMMRunning();
  };

  const backupBtn = document.createElement('button');
  backupBtn.classList.add('btn');
  backupBtn.textContent = '备份配置';
  backupBtn.onclick = async () => {
    if (!(await checkAdvanceFunc())) {
      createToast('没有开启高级功能，无法使用！', 'red');
      return;
    }
    if (!(await checkIsInstalled())) {
      createToast('没有安装猫猫，请先安装！', 'red');
      return;
    }
    createToast('备份猫猫中...', 'green');
    const t = Math.floor(Date.now() + Math.random());
    const res = await runShellWithRoot(`
        rm -f /data/data/com.minikano.f50_sms/files/uploads/mm_config_backup*
        sleep 1
        cp /data/clash/Proxy/config.yaml /data/data/com.minikano.f50_sms/files/uploads/mm_config_backup_${t}.yaml
        chmod 777 /data/data/com.minikano.f50_sms/files/uploads/mm_config_backup_${t}.yaml
        `);
    if (!res.success) return createToast('备份失败！', 'red');
    const a = document.createElement('a');
    a.download = `猫猫配置备份_config_${t}.yaml`;
    a.href = `/api/uploads/mm_config_backup_${t}.yaml`;
    a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  (async () => {
    const wait = (sec = 100) =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, sec);
      });
    const mmContainer = document.querySelector('.functions-container');
    while (!UFI_DATA.lan_ipaddr) {
      await wait();
    }

    mmContainer.insertAdjacentHTML(
      'afterend',
      `
<div id="IFRAME_KANO" style="width: 100%; margin-top: 10px;">
    <div class="title" style="margin: 6px 0 ;">
        <strong id="running_mm">猫猫</strong>
        <div style="display: inline-block;" id="collapse_mm_btn"></div>
    </div>
    <div class="collapse" id="collapse_mm" data-name="close" style="height: 0px; overflow: hidden;">
        <div class="collapse_box">
        <div id="mm_action_box" style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap"></div>
            <ul class="deviceList">
<li style="padding:10px">
        <iframe id="mm_iframe" src="javascript:;" style="border:none;padding:0;margin:0;width:100%;height:500px;border-radius: 10px;overflow: hidden;opacity: .6;"></iframe>
</li> </ul>
        </div>
    </div>
</div>
`,
    );
    const refresh = document.createElement('button');
    refresh.classList.add('btn');
    refresh.textContent = '刷新网页';
    refresh.onclick = () => {
      document.getElementById('mm_iframe').src =
        `http://${UFI_DATA.lan_ipaddr}:7788/ui/?t=` + Date.now();
    };

    const open = document.createElement('button');
    open.classList.add('btn');
    open.textContent = '打开面板';
    open.onclick = () => {
      const a = document.createElement('a');
      a.href = `http://${UFI_DATA.lan_ipaddr}:7788/ui/?t=` + Date.now();
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    const wiki = document.createElement('button');
    wiki.classList.add('btn');
    wiki.textContent = '文档教程';
    wiki.onclick = () => {
      const a = document.createElement('a');
      a.href = `https://wiki.metacubex.one/config/`;
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    const boot_on = document.createElement('button');
    boot_on.id = 'clash_boot_on';
    boot_on.classList.add('btn');
    boot_on.textContent = '开机自启';
    boot_on.style.background = '';
    boot_on.addEventListener('click', async () => {
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      const isBootUp = await checkIsBootUp();
      if (isBootUp) {
        //关闭
        await runShellWithRoot(`
                sed -i '/Clash.Service/d' /sdcard/ufi_tools_boot.sh
                sed -i '/Clash.Inotify/d' /sdcard/ufi_tools_boot.sh
            `);
        boot_on.style.background = '';
        createToast('已取消开机自启', 'green');
      } else {
        //开启
        await runShellWithRoot(`
                grep -qxF '/data/clash/Scripts/Clash.Service start' /sdcard/ufi_tools_boot.sh || echo '/data/clash/Scripts/Clash.Service start' >> /sdcard/ufi_tools_boot.sh
                grep -qxF 'inotifyd /data/clash/Scripts/Clash.Inotify "/data/clash/Clash" >> /dev/null &' /sdcard/ufi_tools_boot.sh || echo 'inotifyd /data/clash/Scripts/Clash.Inotify "/data/clash/Clash" >> /dev/null &' >> /sdcard/ufi_tools_boot.sh
            `);
        boot_on.style.background = 'var(--dark-btn-color-active)';
        createToast('已设置开机自启', 'green');
      }
    });

    checkIsBootUp().then((isBootUp) => {
      if (isBootUp) {
        boot_on.style.background = 'var(--dark-btn-color-active)';
      } else {
        boot_on.style.background = '';
      }
    });

    if (localStorage.getItem('#collapse_mm') == 'open') {
      refresh.click();
      await isMMRunning();
    }

    const uploadCore = document.createElement('button');
    uploadCore.textContent = '更新内核';
    const uploadCoreInput = document.createElement('input');
    uploadCoreInput.type = 'file';
    uploadCoreInput.accept = '*/*';
    uploadCoreInput.style.display = 'none';

    uploadCoreInput.onchange = async (e) => {
      e.stopPropagation();
      if (!e.target || !e.target.files) return;
      if (e.target.files.length == 0) return;
      const file = e.target.files[0];
      if (!file) return;
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      // 检查文件格式
      if (!(await isELF(file))) {
        createToast('只能上传内核二进制文件!', 'red');
        uploadCoreInput.value = '';
        return;
      }
      // 检查文件大小
      if (file.size > 50 * 1024 * 1024) {
        createToast(`文件大小不能超过${50}MB！`, 'red');
        uploadCoreInput.value = '';
        return;
      }

      const { close } = createFixedToast('upload_core_toast', '上传内核中...');

      // 上传文件
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await (
          await fetch(`${KANO_baseURL}/upload_img`, {
            method: 'POST',
            headers: common_headers,
            body: formData,
          })
        ).json();

        if (res.url) {
          close();
          let foundFile = await runShellWithRoot(`
                        ls /data/data/com.minikano.f50_sms/files/${res.url}
                    `);
          if (!foundFile.content) {
            throw '上传失败';
          }
          createToast('上传成功，正在停止内核...', '');
          stopBtn.click();
          let resShell = await runShellWithRoot(
            `
                        rm -f /data/clash/Proxy/Clash.Core
                        mv /data/data/com.minikano.f50_sms/files/${res.url} /data/clash/Proxy/Clash.Core
                        chmod 755 /data/clash/Proxy/Clash.Core
                    `,
            120 * 1000,
          );
          createToast('解压内核...', '');
          if (resShell.success) {
            createToast('上传内核完成,正在启动内核...', 'pink');
            uploadCoreInput.value = '';
            btn_restart.click();
            return;
          }
        }
        throw res.error || '上传失败';
      } catch (e) {
        console.error(e);
        createToast(`上传失败!`, 'red');
        uploadCoreInput.value = '';
        return;
      } finally {
        close();
      }
    };

    uploadCore.onclick = async () => {
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      uploadCoreInput.click();
    };

    const showLogBtn = document.createElement('button');
    showLogBtn.textContent = '查看日志';
    showLogBtn.onclick = async () => {
      if (!checkAdvanceFunc()) {
        return createToast('没有开启高级功能，无法使用！');
      }

      const res = await runShellWithRoot(`
        timeout 2s awk \'{print}\' /sdcard/Clash内核日志.txt | tail -n 100
        `);
      if (!res.success) return createToast('获取日志失败！', 'red');
      if (!res.content) return createToast('日志内容为空！', 'red');
      showDialog(res.content, '猫猫日志 (tail 100)');
    };

    // 订阅链接功能
    const importSub = async () => {
      const { el, close } = createFixedToast(
        'mm_sub_input_toast',
        `
            <div style="pointer-events:all;width:80vw;max-width:800px;">
                <div class="title" style="margin:0">订阅链接</div>
                <div style="margin:20px 0;display: flex;flex-direction: column;gap: 10px;">
                    <input id="mm_sub_url1_input" type="text" placeholder="请输入你的订阅链接1" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;outline:none;">
                    <input id="mm_sub_url2_input" type="text" placeholder="请输入你的订阅链接2(可选)" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;outline:none;">
                    <input id="mm_sub_url3_input" type="text" placeholder="请输入你的订阅链接3(可选)" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;outline:none;">
                </div>
                <div style="text-align:right">
                    <button style="font-size:.64rem" id="mm_sub_submit_btn">提交</button>
                    <button style="font-size:.64rem" id="mm_sub_close_btn">关闭</button>
                </div>
            </div>
        `,
      );

      const url1Input = el.querySelector('#mm_sub_url1_input');
      const url2Input = el.querySelector('#mm_sub_url2_input');
      const url3Input = el.querySelector('#mm_sub_url3_input');

      el.querySelector('#mm_sub_close_btn').onclick = close;
      el.querySelector('#mm_sub_submit_btn').onclick = async () => {
        const url1 = url1Input.value.trim();
        const url2 = url2Input.value.trim();
        const url3 = url3Input.value.trim();

        if (!url1) {
          createToast('请至少输入订阅链接1！！', 'red');
          return;
        }

        createToast('正在处理订阅...', 'yellow');

        try {
          let res = `${url1}`;
          if (url2) {
            res = `${url1} ${url2}\nprovider1 provider2`;
          }
          if (url3) {
            res = `${url1} ${url2} ${url3}\nprovider1 provider2 provider3`;
          }
          const file = new File([res], 'config.yaml', { type: 'text/plain' });
          const success = await saveConfig(file);

          if (success) {
            // 保存订阅链接用于后续刷新
            const subContent = url2 ? (url3 ? `${url1} ${url2} ${url3}\nprovider1 provider2 provider3` : `${url1} ${url2}\nprovider1 provider2`) : url1;
            const b64 = btoa(unescape(encodeURIComponent(subContent)));
            await runShellWithRoot(`echo ${b64} | base64 -d > /data/clash/Proxy/.sub_url`);
            createToast('订阅保存成功，正在重启...', 'green');
            close();
          }
        } catch (e) {
          createToast('处理订阅失败: ' + e, 'red');
        }
      };
    };

    // 创建订阅链接按钮
    const subBtn = document.createElement('button');
    subBtn.classList.add('btn');
    subBtn.textContent = '订阅链接';
    subBtn.onclick = async () => {
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      importSub();
    };

    const mmBox = document.querySelector('#mm_action_box');
    mmBox.appendChild(uploadCoreInput);
    mmBox.appendChild(editBtn);
    mmBox.appendChild(subBtn); // 订阅链接
    // 刷新订阅：整份覆盖 / 仅更新节点（保留规则）
    const refreshProvidersOnly = async () => {
      createToast('正在更新节点（保留现有配置）...', 'yellow');
      // 1) 优先走 Mihomo API 更新各 proxy-provider（不改 config.yaml）
      // 2) 失败则清理 provider 缓存后重启，强制重新拉取节点
      const res = await runShellWithRoot(
        `
YQ="/data/clash/Tools/yq_linux_arm64"
CFG="/data/clash/Proxy/config.yaml"
CURL="/data/data/com.minikano.f50_sms/files/curl"
[ -x "$CURL" ] || CURL="curl"

urlencode() {
  # 按字节百分号编码，兼容中文订阅源名称
  printf %s "$1" | od -An -tx1 2>/dev/null | tr -d ' \\n' | sed 's/../%&/g' | tr 'a-f' 'A-F'
}

if [ ! -f "$CFG" ]; then echo "NO_CONFIG"; exit 0; fi
if [ ! -f "$YQ" ]; then echo "NO_YQ"; exit 0; fi

NAMES=$("$YQ" e '.proxy-providers | keys | .[]' "$CFG" 2>/dev/null)
if [ -z "$NAMES" ]; then echo "NO_PROVIDERS"; exit 0; fi

CTRL=$("$YQ" e '.external-controller // "127.0.0.1:9090"' "$CFG" 2>/dev/null | tr -d '"' | tr -d "'")
SECRET=$("$YQ" e '.secret // ""' "$CFG" 2>/dev/null | tr -d '"' | tr -d "'")
HOSTPORT=$(echo "$CTRL" | sed 's/^0\\.0\\.0\\.0/127.0.0.1/;s/^\\[::\\]/127.0.0.1/;s/^::/127.0.0.1/')
# 同时尝试配置端口与常见端口（猫猫常用 7788）
CANDIDATES="$HOSTPORT"
echo "$HOSTPORT" | grep -q ':7788$' || CANDIDATES="$CANDIDATES 127.0.0.1:7788"
echo "$HOSTPORT" | grep -q ':9090$' || CANDIDATES="$CANDIDATES 127.0.0.1:9090"

call_put() {
  _hp="$1"; _enc="$2"
  if [ -n "$SECRET" ]; then
    "$CURL" -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $SECRET" "http://$_hp/providers/proxies/$_enc" 2>/dev/null || echo 000
  else
    "$CURL" -s -o /dev/null -w "%{http_code}" -X PUT "http://$_hp/providers/proxies/$_enc" 2>/dev/null || echo 000
  fi
}

: > /data/clash/Proxy/.provider_refresh_log
echo "$NAMES" | while IFS= read -r name; do
  [ -z "$name" ] && continue
  ENC=$(urlencode "$name")
  CODE=000
  for HP in $CANDIDATES; do
    CODE=$(call_put "$HP" "$ENC")
    if [ "$CODE" = "204" ] || [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
      break
    fi
  done
  if [ "$CODE" = "204" ] || [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
    echo "OK:$name" >> /data/clash/Proxy/.provider_refresh_log
  else
    echo "FAIL:$name:$CODE" >> /data/clash/Proxy/.provider_refresh_log
  fi
done

# while 在管道子 shell 中，改用日志统计
OK=$(grep -c '^OK:' /data/clash/Proxy/.provider_refresh_log 2>/dev/null || echo 0)
FAIL=$(grep -c '^FAIL:' /data/clash/Proxy/.provider_refresh_log 2>/dev/null || echo 0)
cat /data/clash/Proxy/.provider_refresh_log 2>/dev/null
echo "RESULT:OK=$OK FAIL=$FAIL"
        `,
        120 * 1000,
      );
      if (!res.success) return createToast('更新节点失败！', 'red');
      const out = (res.content || '').trim();
      if (out.includes('NO_CONFIG')) return createToast('未找到配置文件', 'red');
      if (out.includes('NO_YQ')) return createToast('未找到 yq 工具', 'red');
      if (out.includes('NO_PROVIDERS')) {
        return createToast(
          '当前配置没有 proxy-providers，无法仅更新节点。\n请使用「整份配置重新刷新」，或上传带 proxy-providers 的配置（如 OneSmart）。',
          'red',
        );
      }
      const m = out.match(/RESULT:OK=(\d+)\s+FAIL=(\d+)/);
      const ok = m ? Number(m[1]) : 0;
      const fail = m ? Number(m[2]) : -1;
      if (ok > 0 && fail === 0) {
        createToast(`节点已更新（${ok} 个订阅源），配置与规则未改动`, 'green');
        return;
      }
      if (ok > 0 && fail > 0) {
        createToast(`部分订阅源更新成功（成功 ${ok}，失败 ${fail}），请查看面板或日志`, 'yellow');
        return;
      }
      // API 失败兜底：清理 provider 缓存后重启，强制重新拉取
      createToast('面板接口更新失败，尝试清理订阅缓存并重启...', 'yellow');
      await runShellWithRoot(`
YQ="/data/clash/Tools/yq_linux_arm64"
CFG="/data/clash/Proxy/config.yaml"
# 删除各 provider 的 path 缓存文件（若配置了 path）
if [ -f "$YQ" ] && [ -f "$CFG" ]; then
  "$YQ" e '.proxy-providers[].path // ""' "$CFG" 2>/dev/null | while IFS= read -r p; do
    [ -z "$p" ] || [ "$p" = "null" ] && continue
    case "$p" in
      /*) rm -f "$p" 2>/dev/null ;;
      *) rm -f "/data/clash/Proxy/$p" 2>/dev/null ;;
    esac
  done
fi
rm -f /data/clash/Proxy/*.cache 2>/dev/null
rm -rf /data/clash/Proxy/providers /data/clash/Proxy/proxy_provider /data/clash/Proxy/proxy-providers 2>/dev/null
true
      `);
      createToast('已清理订阅缓存，正在重启核心以拉取最新节点（config.yaml 未改动）...', 'green');
      btn_restart.click();
    };

    const refreshFullConfig = async () => {
      const saved = await runShellWithRoot(`cat /data/clash/Proxy/.sub_url 2>/dev/null`);
      if (!saved.success || !saved.content) {
        createToast('没有已保存的订阅，请先使用「订阅链接」添加', 'red');
        return;
      }
      createToast('正在整份刷新订阅（将覆盖 config.yaml）...', 'yellow');
      const b64 = btoa(unescape(encodeURIComponent(saved.content)));
      const written = await runShellWithRoot(`
        echo ${b64} | base64 -d > /data/clash/Proxy/config.yaml
      `);
      if (!written.success) return createToast('写入订阅失败！', 'red');
      createToast('订阅已整份更新，正在重启核心...', 'green');
      btn_restart.click();
    };

    const showRefreshSubDialog = async () => {
      const rid = 'rs_' + createRandomString(4);
      const { el, close } = createFixedToast(
        rid,
        `
            <div style="pointer-events:all;width:88vw;max-width:520px;">
                <div class="title" style="margin:0">刷新订阅</div>
                <div style="margin:12px 0;font-size:.7rem;line-height:1.7;color:#ccc;">
                  请选择刷新方式：
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;margin:10px 0;font-size:.68rem;line-height:1.55;">
                  <label style="display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid #444;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="${rid}_mode" value="nodes" checked style="margin-top:3px;">
                    <span>
                      <b style="color:#0f0">仅更新节点（推荐）</b><br>
                      保留现有 YAML 规则、策略组、DNS 等配置，仅拉取 proxy-providers 最新节点。<br>
                      <span style="opacity:.8">适合 OneSmart 等带 proxy-providers 的完整配置。</span>
                    </span>
                  </label>
                  <label style="display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid #444;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="${rid}_mode" value="full" style="margin-top:3px;">
                    <span>
                      <b style="color:#fa0">整份配置重新刷新</b><br>
                      用已保存的订阅内容覆盖整个 config.yaml。<br>
                      <span style="opacity:.8;color:#f88">会冲掉当前规则与自定义配置，请谨慎使用。</span>
                    </span>
                  </label>
                </div>
                <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end;">
                  <button id="${rid}_ok" style="font-size:.64rem;">确认刷新</button>
                  <button id="${rid}_close" style="font-size:.64rem;">取消</button>
                </div>
            </div>
        `,
      );
      el.querySelector(`#${rid}_close`).onclick = close;
      el.querySelector(`#${rid}_ok`).onclick = async () => {
        const mode =
          el.querySelector(`input[name="${rid}_mode"]:checked`)?.value ||
          'nodes';
        close();
        if (mode === 'full') {
          await refreshFullConfig();
        } else {
          await refreshProvidersOnly();
        }
      };
    };

    const refreshSubBtn = document.createElement('button');
    refreshSubBtn.textContent = '刷新订阅';
    refreshSubBtn.onclick = async () => {
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      await showRefreshSubDialog();
    };
    mmBox.appendChild(refreshSubBtn);
    mmBox.appendChild(uploadBtn);
    mmBox.appendChild(backupBtn);
    mmBox.appendChild(btn_enabled);
    mmBox.appendChild(stopBtn);
    mmBox.appendChild(btn_restart);
    mmBox.appendChild(btn_disabled);
    mmBox.appendChild(boot_on);
    mmBox.appendChild(open);
    mmBox.appendChild(uploadCore);
    mmBox.appendChild(wiki);
    mmBox.appendChild(showLogBtn);
    mmBox.appendChild(refresh);

    // === 自定义规则管理 ===
    const customRulesBtn = document.createElement('button');
    customRulesBtn.textContent = '自定义规则';
    customRulesBtn.onclick = async () => showCustomRulesDialog();
    mmBox.appendChild(customRulesBtn);

    // === 可视化配置编辑器入口 ===
    const visualEditorBtn = document.createElement('button');
    visualEditorBtn.textContent = '🎛️ 可视化配置';
    visualEditorBtn.style.background = 'linear-gradient(135deg,#51cf66,#37b24d)';
    visualEditorBtn.style.color = 'white';
    visualEditorBtn.onclick = async () => {
      if (!(await checkAdvanceFunc())) {
        createToast('没有开启高级功能，无法使用！', 'red');
        return;
      }
      if (!(await checkIsInstalled())) {
        createToast('没有安装猫猫，请先安装！', 'red');
        return;
      }
      showConfigVisualEditor();
    };
    mmBox.appendChild(visualEditorBtn);

    const readCustomRules = async () => {
      const res = await runShellWithRoot(`cat /data/clash/Proxy/custom_rules.yaml 2>/dev/null`);
      return res.success && res.content ? res.content.trim() : '';
    };

    const readProxyGroups = async () => {
      const res = await runShellWithRoot(`/data/clash/Tools/yq_linux_arm64 e '.proxy-groups[].name' /data/clash/Proxy/config.yaml 2>/dev/null`);
      if (!res.success || !res.content) return [];
      return res.content.trim().split('\n').filter(Boolean);
    };

    const showCustomRulesDialog = async () => {
      const rid = 'cr_' + createRandomString(4);
      let groups = [];
      try { groups = await readProxyGroups(); } catch(e) {}
      let rules = (await readCustomRules()) || '';

      const { el, close } = createFixedToast(rid, `
        <div style="pointer-events:all;width:88vw;max-width:600px;">
          <div class="title" style="margin:0">自定义规则</div>
          <div style="margin:10px 0;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <select id="${rid}_type" style="flex:0 0 auto;padding:6px;border:1px solid #555;border-radius:4px;background:#000;color:#0f0;font-size:.64rem;">
                <option>DOMAIN-SUFFIX</option>
                <option>DOMAIN</option>
                <option>DOMAIN-KEYWORD</option>
                <option>IP-CIDR</option>
                <option>IP-CIDR6</option>
                <option>DST-PORT</option>
                <option>SRC-PORT</option>
                <option>GEOIP</option>
              </select>
              <input id="${rid}_value" type="text" placeholder="域名或IP"
                style="flex:1;min-width:80px;padding:6px;border:1px solid #555;border-radius:4px;background:#000;color:#0f0;font-size:.64rem;">
              <select id="${rid}_policy" style="flex:0 0 auto;padding:6px;border:1px solid #555;border-radius:4px;background:#000;color:#0f0;font-size:.64rem;">
                ${groups.length ? groups.map(g => `<option>${g}</option>`).join('') : '<option>Proxy</option><option>Direct</option><option>Reject</option>'}
              </select>
              <button id="${rid}_add" style="font-size:.64rem;padding:6px 12px;">添加</button>
            </div>
            <textarea id="${rid}_textarea" style="width:100%;height:200px;border:1px solid #555;border-radius:4px;background:#000c;color:#0f0;font-size:.64rem;font-family:monospace;box-sizing:border-box;padding:6px;" placeholder="每行一条规则&#10;格式: 类型,值,策略组&#10;如: DOMAIN-SUFFIX,example.com,Proxy">${rules}</textarea>
          </div>
          <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end;">
            <button id="${rid}_save" style="font-size:.64rem;">保存并重启</button>
            <button id="${rid}_stop" style="font-size:.64rem;">删除规则</button>
            <button id="${rid}_close" style="font-size:.64rem;">关闭</button>
          </div>
        </div>
      `);

      const textarea = el.querySelector(`#${rid}_textarea`);
      const typeSel = el.querySelector(`#${rid}_type`);
      const valInp = el.querySelector(`#${rid}_value`);
      const polSel = el.querySelector(`#${rid}_policy`);

      el.querySelector(`#${rid}_close`).onclick = close;
      el.querySelector(`#${rid}_add`).onclick = () => {
        const t = typeSel.value, v = valInp.value.trim(), p = polSel.value;
        if (!v) return createToast('请输入域名或IP', 'red');
        const line = `${t},${v},${p}`;
        const cur = textarea.value.trim();
        textarea.value = cur ? cur + '\n' + line : line;
        valInp.value = '';
        valInp.focus();
      };
      el.querySelector(`#${rid}_stop`).onclick = async () => {
        const selStart = textarea.selectionStart;
        const lines = textarea.value.split('\n');
        const cursorLine = textarea.value.substring(0, selStart).split('\n').length - 1;
        if (cursorLine >= 0 && cursorLine < lines.length) {
          lines.splice(cursorLine, 1);
          textarea.value = lines.join('\n');
        }
      };
      el.querySelector(`#${rid}_save`).onclick = async () => {
        const content = textarea.value.trim();
        if (content) {
          const validLines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
          const invalid = validLines.filter(l => l.split(',').length < 3);
          if (invalid.length) return createToast(`以下规则格式错误(需3段):\n${invalid.join('\n')}`, 'red');
        }
        createToast('保存中...');
        // 用 base64 避免 shell 转义问题
        const b64 = btoa(unescape(encodeURIComponent(content)));
        const res = await runShellWithRoot(`
          echo ${b64} | base64 -d > /data/clash/Proxy/custom_rules.yaml
          chmod 644 /data/clash/Proxy/custom_rules.yaml
        `);
        if (!res.success) return createToast('保存失败!', 'red');
        createToast('保存成功，正在重启核心...', 'green');
        close();
        btn_restart.click();
      };
    };

    let colTimer = null;
    let colTimer1 = null;
    collapseGen('#collapse_mm_btn', '#collapse_mm', '#collapse_mm', (e) => {
      checkIsBootUp().then((isBootUp) => {
        if (isBootUp) {
          boot_on.style.background = 'var(--dark-btn-color-active)';
        } else {
          boot_on.style.background = '';
        }
      });
      colTimer && clearTimeout(colTimer);
      colTimer1 && clearTimeout(colTimer1);
      if (e == 'open') {
        colTimer1 = setTimeout(() => {
          refresh.click();
        }, 300);
      } else {
        colTimer = setTimeout(() => {
          document.getElementById('mm_iframe').src = `javascript:;`;
        }, 300);
      }
    });
    // 修复面板路径按钮：将 WebUI/zashboard/zashboard/ 嵌套文件移到 WebUI/zashboard/
   const fixPanelBtn = document.createElement('button');
fixPanelBtn.textContent = '修复面板路径';
fixPanelBtn.onclick = async () => {
  if (!(await checkAdvanceFunc())) {
    createToast('没有开启高级功能，无法使用！', 'red');
    return;
  }
  if (!(await checkIsInstalled())) {
    createToast('没有安装猫猫，请先安装！', 'red');
    return;
  }
  const res = await runShellWithRoot(`
    ZD=/data/clash/Proxy/WebUI/zashboard
    if [ -d "$ZD/zashboard" ]; then
      # 1. 删除上一层 zashboard/ 目录下的所有内容（排除 zashboard 子文件夹）
      find "$ZD" -mindepth 1 -maxdepth 1 ! -name "zashboard" -exec rm -rf {} + 2>/dev/null
      
      # 2. 移动嵌套的 zashboard/zashboard/ 下的所有内容到上层
      mv "$ZD/zashboard/"* "$ZD/" 2>/dev/null
      mv "$ZD/zashboard/".* "$ZD/" 2>/dev/null  # 移动隐藏文件
      
      # 3. 删除空的嵌套目录
      rmdir "$ZD/zashboard" 2>/dev/null || rm -rf "$ZD/zashboard" 2>/dev/null
      
      echo "DONE"
    else
      echo "NO_NESTED"
    fi
  `, 30000);
  
  if (res.content && res.content.includes('DONE')) {
    createToast('面板文件已修复', 'green');
  } else if (res.content && res.content.includes('NO_NESTED')) {
    createToast('未检测到嵌套目录，无需修复', 'yellow');
  } else {
    createToast('修复失败', 'red');
  }
};
mmBox.appendChild(fixPanelBtn);
    await isMMRunning();
  })();
// ============ 可视化配置编辑器 v2.0（合并自猫猫配置可视化编辑器2.0.js） ============
// 功能：导入配置 → 按区域可视化编辑（全区域可编辑）→ 自定义代理规则 → 保存重启 / 导出配置
// 适用：UFI-TOOLS 后台 + Mihomo/Clash 内核
// 设计原则：区域文本块隔离编辑，不破坏未修改区域；自动备份；操作可回滚
let _mmceInitialized = false;
async function showConfigVisualEditor() {
  'use strict';
  if (_mmceInitialized) {
    try {
      const text = await loadConfigFromDevice();
      parseConfig(text);
      renderAllSections();
      updateStatus();
    } catch (_e) { /* keep existing data */ }
    const btn = document.getElementById('mmce_collapse_btn');
    if (btn) { btn.click(); return; }
    const wrapper = document.getElementById('mmce_wrapper');
    if (wrapper) wrapper.style.display = 'block';
    return;
  }
  _mmceInitialized = true;

  const CONFIG_PATH = '/data/clash/Proxy/config.yaml';
  const UPLOAD_DIR = '/data/data/com.minikano.f50_sms/files';
  const CUSTOM_RULE_START = '# ===== 猫猫配置编辑器-自定义规则开始(请勿手动删除此行) =====';
  const CUSTOM_RULE_END = '# ===== 猫猫配置编辑器-自定义规则结束(请勿手动删除此行) =====';
  const PLUGIN_PREFIX = 'mmce_';

  const editorAskConfirm = (title, body, okText = '确认', cancelText = '取消') =>
    askConfirm('mmce_confirm_' + createRandomString(6), title, body, okText, cancelText);

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  const state = {
    loaded: false, rawText: '', parsed: {}, sections: {},
    customRules: [], isDirty: false, parseError: null, rawEditMode: false,
  };

  // YAML parser
  const parseYAML = (text) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const root = {};
    const stack = [{ indent: -1, obj: root, isList: false, parentObj: null, key: null }];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2).trim();
        if (!parent.isList) {
          if (parent.parentObj && parent.key !== null) { parent.parentObj[parent.key] = []; parent.obj = parent.parentObj[parent.key]; }
          parent.isList = true;
        }
        const kvMatch = value.match(/^([^:]+(?::[^:\s]+)*):(?:\s+(.*))?$/);
        if (kvMatch && !value.startsWith('"') && !value.startsWith("'")) {
          const dict = {};
          const k = kvMatch[1].trim(), v = (kvMatch[2] || '').trim();
          if (v) dict[k] = parseScalar(v);
          parent.obj.push(dict);
          stack.push({ indent, obj: dict, isList: false, parentObj: parent.obj, key: parent.obj.length - 1 });
        } else { parent.obj.push(parseScalar(value)); }
        continue;
      }
      let colonIdx = -1;
      for (let ci = trimmed.length - 1; ci >= 0; ci--) {
        if (trimmed[ci] === ':' && (ci === trimmed.length - 1 || trimmed[ci + 1] === ' ')) { colonIdx = ci; break; }
      }
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim(), value = trimmed.slice(colonIdx + 1).trim();
      if (parent.isList) {
        const currentDict = parent.obj[parent.obj.length - 1];
        if (value) { currentDict[key] = parseScalar(value); }
        else { currentDict[key] = {}; stack.push({ indent, obj: currentDict[key], isList: false, parentObj: currentDict, key }); }
      } else {
        if (value) { parent.obj[key] = parseScalar(value); }
        else { parent.obj[key] = {}; stack.push({ indent, obj: parent.obj[key], isList: false, parentObj: parent.obj, key }); }
      }
    }
    return root;
  };
  const parseScalar = (val) => {
    if (val === 'true' || val === 'True' || val === 'TRUE') return true;
    if (val === 'false' || val === 'False' || val === 'FALSE') return false;
    if (val === 'null' || val === '~' || val === '') return null;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) return val.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
    return val;
  };
  const stringifyYAML = (obj, indent = 0) => {
    const spaces = '  '.repeat(indent);
    let result = '';
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          const keys = Object.keys(item);
          if (keys.length === 0) { result += `${spaces}-\n`; }
          else {
            const firstKey = keys[0], firstVal = item[firstKey];
            if (typeof firstVal === 'object' && firstVal !== null) { result += `${spaces}- ${firstKey}:\n${stringifyYAML(firstVal, indent + 1)}`; }
            else { result += `${spaces}- ${firstKey}: ${scalarToYAML(firstVal)}\n`; }
            for (let i = 1; i < keys.length; i++) {
              const k = keys[i], v = item[k];
              if (typeof v === 'object' && v !== null) { result += `${spaces}  ${k}:\n${stringifyYAML(v, indent + 2)}`; }
              else { result += `${spaces}  ${k}: ${scalarToYAML(v)}\n`; }
            }
          }
        } else { result += `${spaces}- ${scalarToYAML(item)}\n`; }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) && value.length === 0) { result += `${spaces}${key}: []\n`; }
          else if (!Array.isArray(value) && Object.keys(value).length === 0) { result += `${spaces}${key}: {}\n`; }
          else { result += `${spaces}${key}:\n${stringifyYAML(value, indent + 1)}`; }
        } else { result += `${spaces}${key}: ${scalarToYAML(value)}\n`; }
      }
    }
    return result;
  };
  const scalarToYAML = (val) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    const str = String(val);
    const needsQuote = str === '' || /\n/.test(str) || /^[&*!|>'"%@`#{}\[\],;]/.test(str) || /:\s/.test(str) || /\s#/.test(str) || /^(true|false|null|yes|no|on|off|~)$/i.test(str) || /^\s|\s$/.test(str);
    if (needsQuote) return `"${str.replace(/"/g, '\\"')}"`;
    return str;
  };

  const parseConfig = (text) => {
    state.rawText = text; state.parseError = null; state.rawEditMode = false;
    try { state.parsed = parseYAML(text); }
    catch (e) { state.parsed = {}; state.parseError = e.message || String(e); state.rawEditMode = true; }
    state.customRules = extractCustomRules(text);
    if (state.customRules.length > 0 && Array.isArray(state.parsed.rules)) {
      const customSet = new Set(state.customRules);
      state.parsed.rules = state.parsed.rules.filter(r => !customSet.has(r));
    }
    state.sections = splitSections(text); state.loaded = true; state.isDirty = false;
  };
  const extractCustomRules = (text) => {
    const start = text.indexOf(CUSTOM_RULE_START), end = text.indexOf(CUSTOM_RULE_END);
    if (start === -1 || end === -1 || start >= end) return [];
    return text.slice(start + CUSTOM_RULE_START.length, end).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.startsWith('- ')).map(l => l.slice(2).trim());
  };
  const splitSections = (text) => {
    const sections = {};
    const topKeys = ['allow-lan', 'cmfa-plugin', 'dns', 'external-controller', 'external-ui', 'external-ui-url', 'find-process-mode', 'geodata-mode', 'hc', 'keep-alive-idle', 'keep-alive-interval', 'log-level', 'mixed-port', 'mode', 'ntp', 'proxy-groups', 'proxy-providers', 'rp1', 'rule-providers', 'rules', 'secret', 'sniffer', 'tcp-concurrent', 'tproxy-port', 'unified-delay', 'use'];
    const lines = text.split('\n');
    let currentKey = null, currentLines = [];
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):/);
      if (match && topKeys.includes(match[1])) { if (currentKey) sections[currentKey] = currentLines.join('\n'); currentKey = match[1]; currentLines = [line]; }
      else if (currentKey) { currentLines.push(line); }
    }
    if (currentKey) sections[currentKey] = currentLines.join('\n');
    return sections;
  };
  const rebuildConfigText = () => {
    const config = JSON.parse(JSON.stringify(state.parsed));
    const parts = [];
    const orderedKeys = ['mixed-port', 'mode', 'log-level', 'secret', 'allow-lan', 'external-controller', 'external-ui', 'external-ui-url', 'find-process-mode', 'geodata-mode', 'tcp-concurrent', 'tproxy-port', 'unified-delay', 'keep-alive-idle', 'keep-alive-interval', 'cmfa-plugin', 'dns', 'ntp', 'sniffer', 'hc', 'proxy-providers', 'proxy-groups', 'rule-providers', 'rules', 'use', 'rp1'];
    for (const key of orderedKeys) {
      if (config[key] === undefined) continue;
      if (key === 'rules' && state.customRules.length > 0) {
        const rulesList = Array.isArray(config.rules) ? config.rules : [];
        let rulesStr = stringifyYAML({ rules: rulesList }).trimEnd();
        rulesStr += '\n' + CUSTOM_RULE_START + '\n';
        for (const r of state.customRules) rulesStr += '  - ' + r + '\n';
        rulesStr += CUSTOM_RULE_END;
        parts.push(rulesStr);
      } else { parts.push(stringifyYAML({ [key]: config[key] }).trimEnd()); }
    }
    for (const key of Object.keys(config)) { if (!orderedKeys.includes(key)) parts.push(stringifyYAML({ [key]: config[key] }).trimEnd()); }
    return parts.join('\n') + '\n';
  };

  const loadConfigFromDevice = async () => {
    const res = await runShellWithRoot(`timeout 5s awk '{print}' ${CONFIG_PATH}`);
    if (!res?.success || !res.content) throw new Error('读取配置失败');
    return res.content;
  };
  const backupConfig = async () => {
    const ts = Date.now();
    await runShellWithRoot(`cp ${CONFIG_PATH} ${UPLOAD_DIR}/mm_config_backup_${ts}.yaml`);
    createToast(`已备份到 uploads/mm_config_backup_${ts}.yaml`, 'green', 4000);
    return ts;
  };
  const saveConfigToDevice = async () => {
    const text = rebuildConfigText(), ts = Date.now();
    await runShellWithRoot(`cp ${CONFIG_PATH} ${UPLOAD_DIR}/mm_config_backup_${ts}.yaml`);
    const tempFile = `${UPLOAD_DIR}/mm_config_temp_${ts}.yaml`;
    await runShellWithRoot(`cat > ${tempFile} << 'YAMLEOF'\n${text}\nYAMLEOF`);
    await runShellWithRoot(`mv ${tempFile} ${CONFIG_PATH}`);
    return ts;
  };
  const restartClash = async () => {
    await runShellWithRoot(`/data/clash/Scripts/Clash.Service stop`);
    await new Promise(r => setTimeout(r, 1000));
    await runShellWithRoot(`/data/clash/Scripts/Clash.Service start`);
    createToast('内核已重启', 'green', 3000);
  };

  // UI builders
  const buildSectionHeader = (title, icon) => `<div class="title" style="margin:8px 0;font-size:.85rem;"><strong>${icon} ${escapeHtml(title)}</strong></div>`;
  const buildStatusBar = () => `<div id="${PLUGIN_PREFIX}status_bar" style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.04);font-size:.72rem;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;"><span>状态：<span id="${PLUGIN_PREFIX}status_text" style="color:#ff9f43;">未加载配置</span></span><span id="${PLUGIN_PREFIX}dirty_indicator" style="color:#ff6b6b;display:none;">⚠ 有未保存的修改</span></div>`;
  const buildActionBar = () => `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"><button id="${PLUGIN_PREFIX}btn_load" class="btn" style="font-size:.72rem;">📂 读取当前配置</button><button id="${PLUGIN_PREFIX}btn_import" class="btn" style="font-size:.72rem;">📥 导入配置文件</button><button id="${PLUGIN_PREFIX}btn_export" class="btn" style="font-size:.72rem;background:linear-gradient(135deg,#4dabf7,#339af0);color:white;">💾 导出配置</button><button id="${PLUGIN_PREFIX}btn_validate" class="btn" style="font-size:.72rem;background:linear-gradient(135deg,#ffd43b,#fab005);color:#333;">✅ 验证配置</button><button id="${PLUGIN_PREFIX}btn_save" class="btn" style="font-size:.72rem;background:linear-gradient(135deg,#51cf66,#37b24d);color:white;">💾 保存并重启</button><button id="${PLUGIN_PREFIX}btn_backup" class="btn" style="font-size:.72rem;">📋 备份配置</button><button id="${PLUGIN_PREFIX}btn_raw" class="btn" style="font-size:.72rem;">📝 查看原始配置</button></div><input type="file" id="${PLUGIN_PREFIX}file_input" accept=".yaml,.yml,.txt" style="display:none;">`;
  const buildBasicSection = () => `<div id="${PLUGIN_PREFIX}section_basic" style="display:none;">${buildSectionHeader('基础设置', '⚙️')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div id="${PLUGIN_PREFIX}basic_fields" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div></div></div>`;
  const buildDNSSection = () => `<div id="${PLUGIN_PREFIX}section_dns" style="display:none;">${buildSectionHeader('DNS 配置', '🌐')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div id="${PLUGIN_PREFIX}dns_content"></div></div></div>`;
  const buildProviderSection = () => `<div id="${PLUGIN_PREFIX}section_providers" style="display:none;">${buildSectionHeader('代理提供者（订阅链接）', '🔗')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div id="${PLUGIN_PREFIX}providers_list"></div><button id="${PLUGIN_PREFIX}btn_add_provider" class="btn" style="font-size:.7rem;margin-top:8px;">+ 添加订阅链接</button></div></div>`;
  const buildRuleProviderSection = () => `<div id="${PLUGIN_PREFIX}section_rule_providers" style="display:none;">${buildSectionHeader('规则集（rule-providers）', '📚')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div id="${PLUGIN_PREFIX}rule_providers_list"></div><button id="${PLUGIN_PREFIX}btn_add_rule_provider" class="btn" style="font-size:.7rem;margin-top:8px;">+ 添加规则集</button></div></div>`;
  const buildRulesSection = () => `<div id="${PLUGIN_PREFIX}section_rules" style="display:none;">${buildSectionHeader('代理规则（rules）', '📋')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div style="margin-bottom:8px;color:#aaa;">共 <span id="${PLUGIN_PREFIX}rules_count">0</span> 条规则（含自定义规则）</div><div id="${PLUGIN_PREFIX}rules_list" style="max-height:400px;overflow-y:auto;"></div><button id="${PLUGIN_PREFIX}btn_add_rule" class="btn" style="font-size:.7rem;margin-top:8px;">+ 添加规则</button></div></div>`;
  const buildCustomSection = () => `<div id="${PLUGIN_PREFIX}section_custom" style="display:none;">${buildSectionHeader('自定义规则', '✨')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div style="display:grid;grid-template-columns:120px 1fr 120px auto;gap:8px;align-items:center;margin-bottom:10px;"><select id="${PLUGIN_PREFIX}custom_type" style="padding:6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;"><option value="domain">域名 (DOMAIN-SUFFIX)</option><option value="ip">IP/IP段 (IP-CIDR)</option><option value="keyword">关键词 (DOMAIN-KEYWORD)</option></select><input id="${PLUGIN_PREFIX}custom_value" type="text" placeholder="输入内容，如 google.com / 1.1.1.1 / baidu" style="padding:6px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;"><select id="${PLUGIN_PREFIX}custom_policy" style="padding:6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;"><option value="选择节点">选择节点</option><option value="国内网站">国内网站</option><option value="DIRECT">DIRECT 直连</option><option value="REJECT">REJECT 拦截</option></select><button id="${PLUGIN_PREFIX}btn_add_custom" class="btn" style="font-size:.7rem;white-space:nowrap;">+ 添加</button></div><div id="${PLUGIN_PREFIX}custom_list" style="margin-top:8px;"></div><div id="${PLUGIN_PREFIX}custom_empty" style="color:#888;text-align:center;padding:12px;">暂无自定义规则，在上方添加</div></div></div>`;
  const buildProxyGroupSection = () => `<div id="${PLUGIN_PREFIX}section_groups" style="display:none;">${buildSectionHeader('代理组（proxy-groups）', '👥')}<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);font-size:.72rem;"><div id="${PLUGIN_PREFIX}groups_list"></div><button id="${PLUGIN_PREFIX}btn_add_group" class="btn" style="font-size:.7rem;margin-top:8px;">+ 添加代理组</button></div></div>`;
  const buildRawEditSection = () => `<div id="${PLUGIN_PREFIX}section_raw" style="display:none;">${buildSectionHeader('原始文本编辑（修复模式）', '🛠️')}<div style="padding:10px;border-radius:8px;background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.15);font-size:.72rem;margin-bottom:10px;"><div style="color:#ff6b6b;margin-bottom:6px;">⚠ 当配置 YAML 解析失败时，可在此手动编辑修复，编辑后点击「重新解析」恢复可视化编辑。</div><div id="${PLUGIN_PREFIX}raw_error_msg" style="color:#ff9f43;font-family:monospace;font-size:.68rem;white-space:pre-wrap;word-break:break-all;display:none;"></div></div><textarea id="${PLUGIN_PREFIX}raw_editor" rows="30" style="width:100%;padding:10px;border-radius:8px;background:rgba(0,0,0,.4);color:#0f0;border:1px solid #333;font-family:monospace;font-size:.7rem;box-sizing:border-box;resize:vertical;line-height:1.5;"></textarea><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button id="${PLUGIN_PREFIX}btn_reparse" class="btn" style="font-size:.72rem;background:linear-gradient(135deg,#51cf66,#37b24d);color:white;">🔄 重新解析</button><button id="${PLUGIN_PREFIX}btn_validate_raw" class="btn" style="font-size:.72rem;">✅ 验证 YAML</button></div></div>`;
  const buildSectionNav = () => `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;"><button class="${PLUGIN_PREFIX}nav_btn btn active" data-section="basic" style="font-size:.68rem;padding:4px 10px;">基础设置</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="dns" style="font-size:.68rem;padding:4px 10px;">DNS</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="providers" style="font-size:.68rem;padding:4px 10px;">订阅链接</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="rule_providers" style="font-size:.68rem;padding:4px 10px;">规则集</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="rules" style="font-size:.68rem;padding:4px 10px;">代理规则</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="custom" style="font-size:.68rem;padding:4px 10px;background:rgba(81,207,102,.2);">✨自定义规则</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="groups" style="font-size:.68rem;padding:4px 10px;">代理组</button><button class="${PLUGIN_PREFIX}nav_btn btn" data-section="raw" style="font-size:.68rem;padding:4px 10px;background:rgba(255,107,107,.15);color:#ff6b6b;">🛠️原始编辑</button></div>`;
  const buildTips = () => `<div style="margin-top:16px;padding:10px;border-radius:8px;background:rgba(255,159,67,.06);border:1px solid rgba(255,159,67,.15);font-size:.68rem;color:#ff9f43;line-height:1.7;"><b>💡 使用提示</b><br>1. 首次使用请点击「读取当前配置」加载设备上的猫猫配置<br>2. 所有区域均可直接编辑，修改后状态会显示「已修改（未保存）」<br>3. 规则集、代理规则、代理组均支持添加、删除、修改操作，代理组支持上下排序<br>4. 自定义规则支持域名/IP/关键词三种方式，自动插入到规则列表<br>5. 点击「验证配置」可提前检查 YAML 格式是否正确<br>6. 若配置解析失败，会自动进入「原始编辑」模式，可手动修复后点击「重新解析」恢复可视化<br>7. 点击「导出配置」可下载当前 YAML 配置文件<br>8. 点击「保存并重启」生效，保存前自动验证并备份原配置到 uploads 目录<br>9. 插件使用过程可能会出现BUG，编辑前先在猫猫那里备份配置<br>10. 如配置异常，可在 uploads 目录找到备份文件恢复</div>`;

  // Render functions
  const getProxyGroupNames = () => { const groups = state.parsed['proxy-groups']; return Array.isArray(groups) ? groups.map(g => g.name).filter(Boolean) : []; };

  const renderBasicSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}basic_fields`);
    if (!container) return;
    const fields = [
      { key: 'mixed-port', label: '混合代理端口', type: 'number' }, { key: 'mode', label: '代理模式', type: 'select', options: ['rule', 'global', 'direct'] },
      { key: 'log-level', label: '日志级别', type: 'select', options: ['info', 'debug', 'warning', 'error', 'silent'] }, { key: 'secret', label: '面板密码', type: 'text' },
      { key: 'external-controller', label: '面板监听地址', type: 'text' }, { key: 'allow-lan', label: '允许局域网', type: 'select', options: ['true', 'false'] },
      { key: 'tcp-concurrent', label: 'TCP并发', type: 'select', options: ['true', 'false'] }, { key: 'unified-delay', label: '统一延迟测试', type: 'select', options: ['true', 'false'] },
      { key: 'geodata-mode', label: 'GeoData模式', type: 'select', options: ['true', 'false'] }, { key: 'tproxy-port', label: 'TProxy端口', type: 'number' },
      { key: 'find-process-mode', label: '进程查找模式', type: 'select', options: ['off', 'strict', 'always'] }, { key: 'external-ui', label: '面板目录', type: 'text' },
    ];
    let html = '';
    for (const f of fields) {
      const val = state.parsed[f.key], valStr = val === undefined ? '' : String(val);
      html += `<div style="display:flex;flex-direction:column;gap:3px;"><label style="font-size:.65rem;color:#aaa;">${f.label}</label>${f.type === 'select' ? `<select data-basic-key="${f.key}" style="padding:5px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;">${f.options.map(o => `<option value="${o}" ${o === valStr ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input type="${f.type}" data-basic-key="${f.key}" value="${escapeHtml(valStr)}" style="padding:5px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;">`}</div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-basic-key]').forEach(el => {
      el.addEventListener('change', () => { const key = el.dataset.basicKey; let val = el.value; if (el.type === 'number') val = Number(val); else if (val === 'true') val = true; else if (val === 'false') val = false; state.parsed[key] = val; markDirty(); });
    });
  };

  const renderDNSSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}dns_content`);
    if (!container) return;
    const dns = state.parsed.dns || {};
    const simpleFields = [
      { key: 'enable', label: '启用DNS', type: 'select', options: ['true', 'false'] }, { key: 'listen', label: '监听地址', type: 'text' },
      { key: 'enhanced-mode', label: '增强模式', type: 'select', options: ['redir-host', 'fake-ip'] }, { key: 'ipv6', label: 'IPv6', type: 'select', options: ['true', 'false'] },
      { key: 'respect-rules', label: '遵守规则', type: 'select', options: ['true', 'false'] }, { key: 'perfer-h3', label: '偏好HTTP/3', type: 'select', options: ['true', 'false'] },
    ];
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
    for (const f of simpleFields) {
      const val = dns[f.key], valStr = val === undefined ? '' : String(val);
      html += `<div style="display:flex;flex-direction:column;gap:3px;"><label style="font-size:.65rem;color:#aaa;">${f.label}</label>${f.type === 'select' ? `<select data-dns-key="${f.key}" style="padding:5px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;">${f.options.map(o => `<option value="${o}" ${o === valStr ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input type="text" data-dns-key="${f.key}" value="${escapeHtml(valStr)}" style="padding:5px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;">`}</div>`;
    }
    html += '</div>';
    const listFields = [{ key: 'default-nameserver', label: '默认 DNS（必须是IP）' }, { key: 'nameserver', label: '主要 DNS' }, { key: 'proxy-server-nameserver', label: '代理节点 DNS' }, { key: 'direct-nameserver', label: '直连 DNS' }];
    for (const lf of listFields) {
      const rawList = dns[lf.key], list = Array.isArray(rawList) ? rawList : (rawList ? [String(rawList)] : []);
      html += `<div style="margin-bottom:10px;"><div style="color:#aaa;font-size:.65rem;margin-bottom:4px;">${lf.label}</div><div id="${PLUGIN_PREFIX}dns_list_${lf.key}" style="display:flex;flex-direction:column;gap:4px;">${list.map((item, idx) => `<div style="display:flex;gap:4px;align-items:center;"><input type="text" data-dns-list="${lf.key}" data-idx="${idx}" value="${escapeHtml(item)}" style="flex:1;padding:4px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.7rem;font-family:monospace;"><button class="${PLUGIN_PREFIX}dns_list_del" data-list="${lf.key}" data-idx="${idx}" style="padding:3px 8px;font-size:.65rem;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div>`).join('')}</div><button class="${PLUGIN_PREFIX}dns_list_add" data-list="${lf.key}" style="margin-top:4px;font-size:.65rem;padding:3px 10px;">+ 添加</button></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-dns-key]').forEach(el => { el.addEventListener('change', () => { if (!state.parsed.dns) state.parsed.dns = {}; let val = el.value; if (val === 'true') val = true; else if (val === 'false') val = false; state.parsed.dns[el.dataset.dnsKey] = val; markDirty(); }); });
    container.querySelectorAll('[data-dns-list]').forEach(el => { el.addEventListener('change', () => { const key = el.dataset.dnsList, idx = Number(el.dataset.idx); if (!state.parsed.dns) state.parsed.dns = {}; if (!Array.isArray(state.parsed.dns[key])) state.parsed.dns[key] = []; state.parsed.dns[key][idx] = el.value; markDirty(); }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}dns_list_del`).forEach(btn => { btn.addEventListener('click', () => { const key = btn.dataset.list, idx = Number(btn.dataset.idx); if (Array.isArray(state.parsed.dns?.[key])) { state.parsed.dns[key].splice(idx, 1); renderDNSSection(); markDirty(); } }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}dns_list_add`).forEach(btn => { btn.addEventListener('click', () => { const key = btn.dataset.list; if (!state.parsed.dns) state.parsed.dns = {}; if (!Array.isArray(state.parsed.dns[key])) state.parsed.dns[key] = []; state.parsed.dns[key].push(''); renderDNSSection(); markDirty(); }); });
  };

  const renderProvidersSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}providers_list`);
    if (!container) return;
    const providers = state.parsed['proxy-providers'] || {}, names = Object.keys(providers);
    if (names.length === 0) { container.innerHTML = '<div style="color:#888;text-align:center;padding:12px;">暂无订阅链接</div>'; return; }
    let html = '';
    for (const name of names) {
      const p = providers[name];
      html += `<div style="padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:bold;color:#eee;">🔗 ${escapeHtml(name)}</span><button class="${PLUGIN_PREFIX}provider_del" data-name="${name}" style="font-size:.65rem;padding:3px 10px;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">类型</label><select data-provider="${name}" data-field="type" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="http" ${p.type === 'http' ? 'selected' : ''}>http</option><option value="file" ${p.type === 'file' ? 'selected' : ''}>file</option></select></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">更新间隔(秒)</label><input type="number" data-provider="${name}" data-field="interval" value="${escapeHtml(p.interval || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"></div></div><div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;"><label style="font-size:.6rem;color:#888;">URL</label><input type="text" data-provider="${name}" data-field="url" value="${escapeHtml(p.url || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;"></div><div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;"><label style="font-size:.6rem;color:#888;">路径</label><input type="text" data-provider="${name}" data-field="path" value="${escapeHtml(p.path || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;"></div></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-provider]').forEach(el => { el.addEventListener('change', () => { const name = el.dataset.provider, field = el.dataset.field; if (!state.parsed['proxy-providers']) state.parsed['proxy-providers'] = {}; if (!state.parsed['proxy-providers'][name]) state.parsed['proxy-providers'][name] = {}; let val = el.value; if (el.type === 'number') val = Number(val); state.parsed['proxy-providers'][name][field] = val; markDirty(); }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}provider_del`).forEach(btn => { btn.addEventListener('click', async () => { const name = btn.dataset.name; if (!(await editorAskConfirm('删除订阅', '确定要删除订阅「' + name + '」吗？'))) return; delete state.parsed['proxy-providers']?.[name]; renderProvidersSection(); markDirty(); }); });
  };

  const renderRuleProvidersSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}rule_providers_list`);
    if (!container) return;
    const rps = state.parsed['rule-providers'] || {}, names = Object.keys(rps);
    if (names.length === 0) { container.innerHTML = '<div style="color:#888;text-align:center;padding:12px;">暂无规则集</div>'; return; }
    let html = '';
    for (const name of names) {
      const rp = rps[name];
      html += `<div style="padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:bold;color:#eee;">📚 ${escapeHtml(name)}</span><button class="${PLUGIN_PREFIX}rp_del" data-name="${name}" style="font-size:.65rem;padding:3px 10px;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;"><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">行为</label><select data-rp="${name}" data-field="behavior" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="domain" ${rp.behavior === 'domain' ? 'selected' : ''}>domain</option><option value="ipcidr" ${rp.behavior === 'ipcidr' ? 'selected' : ''}>ipcidr</option><option value="classical" ${rp.behavior === 'classical' ? 'selected' : ''}>classical</option></select></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">格式</label><select data-rp="${name}" data-field="format" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="yaml" ${rp.format === 'yaml' ? 'selected' : ''}>yaml</option><option value="mrs" ${rp.format === 'mrs' ? 'selected' : ''}>mrs</option><option value="text" ${rp.format === 'text' ? 'selected' : ''}>text</option></select></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">类型</label><select data-rp="${name}" data-field="type" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="http" ${rp.type === 'http' ? 'selected' : ''}>http</option><option value="file" ${rp.type === 'file' ? 'selected' : ''}>file</option></select></div></div><div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;"><label style="font-size:.6rem;color:#888;">URL</label><input type="text" data-rp="${name}" data-field="url" value="${escapeHtml(rp.url || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;"><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">路径</label><input type="text" data-rp="${name}" data-field="path" value="${escapeHtml(rp.path || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;"></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">更新间隔(秒)</label><input type="number" data-rp="${name}" data-field="interval" value="${escapeHtml(rp.interval || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"></div></div></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-rp]').forEach(el => { el.addEventListener('change', () => { const name = el.dataset.rp, field = el.dataset.field; if (!state.parsed['rule-providers']) state.parsed['rule-providers'] = {}; if (!state.parsed['rule-providers'][name]) state.parsed['rule-providers'][name] = {}; let val = el.value; if (el.type === 'number') val = Number(val); state.parsed['rule-providers'][name][field] = val; markDirty(); }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}rp_del`).forEach(btn => { btn.addEventListener('click', async () => { const name = btn.dataset.name; if (!(await editorAskConfirm('删除规则集', '确定要删除规则集「' + name + '」吗？'))) return; delete state.parsed['rule-providers']?.[name]; renderRuleProvidersSection(); markDirty(); }); });
  };

  const renderRulesSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}rules_list`), countEl = document.getElementById(`${PLUGIN_PREFIX}rules_count`);
    if (!container) return;
    const rules = state.parsed['rules'] || [];
    if (countEl) countEl.textContent = rules.length + state.customRules.length;
    let html = '';
    for (let i = 0; i < rules.length; i++) {
      html += `<div style="display:flex;gap:4px;align-items:center;padding:4px 6px;margin-bottom:3px;border-radius:4px;${i % 2 === 0 ? 'background:rgba(255,255,255,.02);' : ''}"><span style="color:#666;font-size:.65rem;min-width:28px;">#${i + 1}</span><input type="text" data-rule-idx="${i}" value="${escapeHtml(rules[i])}" style="flex:1;padding:4px 8px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.68rem;font-family:monospace;"><button class="${PLUGIN_PREFIX}rule_up" data-idx="${i}" style="padding:3px 6px;font-size:.6rem;background:rgba(255,255,255,.08);color:#ccc;border:none;border-radius:4px;cursor:pointer;" title="上移">↑</button><button class="${PLUGIN_PREFIX}rule_down" data-idx="${i}" style="padding:3px 6px;font-size:.6rem;background:rgba(255,255,255,.08);color:#ccc;border:none;border-radius:4px;cursor:pointer;" title="下移">↓</button><button class="${PLUGIN_PREFIX}rule_del" data-idx="${i}" style="padding:3px 8px;font-size:.65rem;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div>`;
    }
    if (state.customRules.length > 0) {
      html += `<div style="margin:10px 0 4px;padding:4px 8px;background:rgba(81,207,102,.1);border-radius:4px;color:#51cf66;font-size:.65rem;">✨ 以下为自定义规则（在自定义规则标签页管理）</div>`;
      for (let i = 0; i < state.customRules.length; i++) { html += `<div style="display:flex;gap:4px;align-items:center;padding:4px 6px;margin-bottom:3px;border-radius:4px;background:rgba(81,207,102,.05);"><span style="color:#51cf66;font-size:.65rem;min-width:28px;">C${i + 1}</span><span style="flex:1;padding:4px 8px;font-family:monospace;font-size:.68rem;color:#a9e34b;word-break:break-all;">${escapeHtml(state.customRules[i])}</span></div>`; }
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-rule-idx]').forEach(el => { el.addEventListener('change', () => { const idx = Number(el.dataset.ruleIdx); if (!Array.isArray(state.parsed['rules'])) state.parsed['rules'] = []; state.parsed['rules'][idx] = el.value; markDirty(); }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}rule_del`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx); if (Array.isArray(state.parsed['rules'])) { state.parsed['rules'].splice(idx, 1); renderRulesSection(); markDirty(); } }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}rule_up`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx); if (idx > 0 && Array.isArray(state.parsed['rules'])) { [state.parsed['rules'][idx - 1], state.parsed['rules'][idx]] = [state.parsed['rules'][idx], state.parsed['rules'][idx - 1]]; renderRulesSection(); markDirty(); } }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}rule_down`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx), rules = state.parsed['rules']; if (Array.isArray(rules) && idx < rules.length - 1) { [rules[idx], rules[idx + 1]] = [rules[idx + 1], rules[idx]]; renderRulesSection(); markDirty(); } }); });
  };

  const renderCustomSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}custom_list`), emptyEl = document.getElementById(`${PLUGIN_PREFIX}custom_empty`);
    if (!container) return;
    const policySelect = document.getElementById(`${PLUGIN_PREFIX}custom_policy`);
    if (policySelect) {
      const groupNames = getProxyGroupNames(), currentVal = policySelect.value;
      policySelect.innerHTML = ['选择节点', '国内网站', 'DIRECT', 'REJECT', ...groupNames.filter(g => !['选择节点', '国内网站'].includes(g))].map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      policySelect.value = groupNames.includes(currentVal) ? currentVal : '选择节点';
    }
    if (state.customRules.length === 0) { container.innerHTML = ''; if (emptyEl) emptyEl.style.display = 'block'; return; }
    if (emptyEl) emptyEl.style.display = 'none';
    let html = '';
    for (let i = 0; i < state.customRules.length; i++) { html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;border-radius:6px;background:rgba(81,207,102,.06);border:1px solid rgba(81,207,102,.15);"><span style="color:#51cf66;font-size:.65rem;min-width:24px;">#${i + 1}</span><span style="flex:1;font-family:monospace;font-size:.68rem;color:#ccc;word-break:break-all;">${escapeHtml(state.customRules[i])}</span><button class="${PLUGIN_PREFIX}custom_del" data-idx="${i}" style="font-size:.65rem;padding:2px 8px;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div>`; }
    container.innerHTML = html;
    container.querySelectorAll(`.${PLUGIN_PREFIX}custom_del`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx); state.customRules.splice(idx, 1); renderCustomSection(); renderRulesSection(); markDirty(); }); });
  };

  const renderProxyGroupsSection = () => {
    const container = document.getElementById(`${PLUGIN_PREFIX}groups_list`);
    if (!container) return;
    const groupList = Array.isArray(state.parsed['proxy-groups']) ? state.parsed['proxy-groups'] : [];
    if (groupList.length === 0) { container.innerHTML = '<div style="color:#888;text-align:center;padding:12px;">暂无代理组</div>'; return; }
    let html = '';
    for (let i = 0; i < groupList.length; i++) {
      const g = groupList[i], proxies = Array.isArray(g.proxies) ? g.proxies : (g.proxies ? [g.proxies] : []);
      html += `<div style="padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:bold;color:#eee;"><span style="color:#888;font-size:.65rem;margin-right:6px;">#${i + 1}</span>👥 ${escapeHtml(g.name || '未命名')}</span><div style="display:flex;gap:4px;align-items:center;"><button class="${PLUGIN_PREFIX}group_up" data-idx="${i}" style="padding:3px 8px;font-size:.65rem;background:rgba(255,255,255,.08);color:#ccc;border:none;border-radius:4px;cursor:pointer;" title="上移">↑</button><button class="${PLUGIN_PREFIX}group_down" data-idx="${i}" style="padding:3px 8px;font-size:.65rem;background:rgba(255,255,255,.08);color:#ccc;border:none;border-radius:4px;cursor:pointer;" title="下移">↓</button><button class="${PLUGIN_PREFIX}group_del" data-idx="${i}" style="font-size:.65rem;padding:3px 10px;background:rgba(255,107,107,.2);color:#ff6b6b;border:none;border-radius:4px;cursor:pointer;">删除</button></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">名称</label><input type="text" data-group="${i}" data-field="name" value="${escapeHtml(g.name || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">类型</label><select data-group="${i}" data-field="type" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="select" ${g.type === 'select' ? 'selected' : ''}>select</option><option value="url-test" ${g.type === 'url-test' ? 'selected' : ''}>url-test</option><option value="fallback" ${g.type === 'fallback' ? 'selected' : ''}>fallback</option><option value="load-balance" ${g.type === 'load-balance' ? 'selected' : ''}>load-balance</option><option value="relay" ${g.type === 'relay' ? 'selected' : ''}>relay</option></select></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;"><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">包含所有节点</label><select data-group="${i}" data-field="include-all" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"><option value="false" ${!g['include-all'] ? 'selected' : ''}>false</option><option value="true" ${g['include-all'] ? 'selected' : ''}>true</option></select></div><div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:.6rem;color:#888;">过滤关键词</label><input type="text" data-group="${i}" data-field="filter" value="${escapeHtml(g.filter || '')}" placeholder="如 港|台|日" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;"></div></div><div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;"><label style="font-size:.6rem;color:#888;">图标URL</label><input type="text" data-group="${i}" data-field="icon" value="${escapeHtml(g.icon || '')}" style="padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;"></div><div style="margin-top:6px;"><div style="font-size:.6rem;color:#888;margin-bottom:3px;">成员节点（每行一个，可填节点名或其他代理组名）</div><textarea data-group="${i}" data-field="proxies" rows="${Math.max(2, proxies.length)}" style="width:100%;padding:4px 6px;border-radius:4px;background:rgba(0,0,0,.3);color:#eee;border:1px solid #555;font-size:.65rem;font-family:monospace;box-sizing:border-box;resize:vertical;">${proxies.map(p => escapeHtml(typeof p === 'string' ? p : p.name)).join('\n')}</textarea></div></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-group]').forEach(el => { el.addEventListener('change', () => { const idx = Number(el.dataset.group), field = el.dataset.field; if (!Array.isArray(state.parsed['proxy-groups'])) state.parsed['proxy-groups'] = []; if (!state.parsed['proxy-groups'][idx]) state.parsed['proxy-groups'][idx] = {}; if (field === 'proxies') { state.parsed['proxy-groups'][idx].proxies = el.value.split('\n').map(s => s.trim()).filter(Boolean); } else if (field === 'include-all') { state.parsed['proxy-groups'][idx]['include-all'] = el.value === 'true'; } else { state.parsed['proxy-groups'][idx][field] = el.value; } markDirty(); }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}group_del`).forEach(btn => { btn.addEventListener('click', async () => { const idx = Number(btn.dataset.idx), g = state.parsed['proxy-groups']?.[idx]; if (!(await editorAskConfirm('删除代理组', '确定要删除代理组「' + (g?.name || '未命名') + '」吗？'))) return; if (Array.isArray(state.parsed['proxy-groups'])) { state.parsed['proxy-groups'].splice(idx, 1); renderProxyGroupsSection(); markDirty(); } }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}group_up`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx), groups = state.parsed['proxy-groups']; if (idx > 0 && Array.isArray(groups)) { [groups[idx - 1], groups[idx]] = [groups[idx], groups[idx - 1]]; renderProxyGroupsSection(); markDirty(); } }); });
    container.querySelectorAll(`.${PLUGIN_PREFIX}group_down`).forEach(btn => { btn.addEventListener('click', () => { const idx = Number(btn.dataset.idx), groups = state.parsed['proxy-groups']; if (Array.isArray(groups) && idx < groups.length - 1) { [groups[idx], groups[idx + 1]] = [groups[idx + 1], groups[idx]]; renderProxyGroupsSection(); markDirty(); } }); });
  };

  const renderRawEditSection = () => {
    const editor = document.getElementById(`${PLUGIN_PREFIX}raw_editor`), errorEl = document.getElementById(`${PLUGIN_PREFIX}raw_error_msg`);
    if (!editor) return;
    if (!editor.dataset.touched) editor.value = state.rawText || '';
    if (errorEl) { if (state.parseError) { errorEl.style.display = 'block'; errorEl.textContent = '解析错误：' + state.parseError; } else { errorEl.style.display = 'none'; } }
  };
  const renderAllSections = () => { renderBasicSection(); renderDNSSection(); renderProvidersSection(); renderRuleProvidersSection(); renderRulesSection(); renderCustomSection(); renderProxyGroupsSection(); renderRawEditSection(); };

  const validateConfig = (text) => {
    try {
      const parsed = parseYAML(text);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { valid: false, error: '配置根节点必须是键值对结构' };
      if (parsed['mixed-port'] !== undefined && typeof parsed['mixed-port'] !== 'number') return { valid: false, error: 'mixed-port 必须是数字' };
      if (parsed['allow-lan'] !== undefined && typeof parsed['allow-lan'] !== 'boolean') return { valid: false, error: 'allow-lan 必须是 true/false' };
      if (parsed['proxy-groups'] !== undefined && !Array.isArray(parsed['proxy-groups'])) return { valid: false, error: 'proxy-groups 必须是列表' };
      if (parsed['rules'] !== undefined && !Array.isArray(parsed['rules'])) return { valid: false, error: 'rules 必须是列表' };
      if (parsed['dns'] !== undefined && (typeof parsed['dns'] !== 'object' || Array.isArray(parsed['dns']))) return { valid: false, error: 'dns 必须是键值对结构' };
      return { valid: true, error: null };
    } catch (e) { return { valid: false, error: e.message || String(e) }; }
  };

  const markDirty = () => { state.isDirty = true; const indicator = document.getElementById(`${PLUGIN_PREFIX}dirty_indicator`); if (indicator) indicator.style.display = 'inline'; updateStatus(); };
  const updateStatus = () => {
    const el = document.getElementById(`${PLUGIN_PREFIX}status_text`);
    if (!el) return;
    if (!state.loaded) { el.textContent = '未加载配置'; el.style.color = '#ff9f43'; }
    else if (state.parseError) { el.textContent = '⚠ 解析失败（原始编辑模式）'; el.style.color = '#ff6b6b'; }
    else if (state.rawEditMode) { el.textContent = '原始编辑模式'; el.style.color = '#ff9f43'; }
    else if (state.isDirty) { el.textContent = '已修改（未保存）'; el.style.color = '#ff6b6b'; }
    else { el.textContent = '已加载，配置完整'; el.style.color = '#51cf66'; }
  };

  const exportConfig = () => {
    const text = state.rawEditMode ? (document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value || state.rawText) : rebuildConfigText();
    const blob = new Blob([text], { type: 'application/x-yaml' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `config_${new Date().toISOString().slice(0, 10)}.yaml`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    createToast('配置已导出', 'green');
  };

  const showSection = (name) => {
    document.querySelectorAll('[id^="' + PLUGIN_PREFIX + 'section_"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`${PLUGIN_PREFIX}section_${name}`);
    if (target) target.style.display = 'block';
    document.querySelectorAll(`.${PLUGIN_PREFIX}nav_btn`).forEach(btn => { btn.classList.remove('active'); btn.style.background = ''; });
    const activeBtn = document.querySelector(`.${PLUGIN_PREFIX}nav_btn[data-section="${name}"]`);
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.style.background = 'var(--dark-btn-color-active)'; }
  };

  // Create UI
  const mmContainer = document.querySelector('.functions-container');
  if (!mmContainer) { console.error(PLUGIN_PREFIX + ': .functions-container not found'); return; }

  mmContainer.insertAdjacentHTML('afterend', `
    <div id="mmce_wrapper" style="width:100%;margin-top:10px;">
      <div class="title" style="margin:6px 0;">
        <strong>🎛️ 猫猫配置可视化编辑器 v2.0</strong>
        <div style="display:inline-block;" id="mmce_collapse_btn"></div>
      </div>
      <div class="collapse" id="mmce_collapse" data-name="close" style="height:0;overflow:hidden;">
        <div class="collapse_box">
          ${buildStatusBar()}
          ${buildActionBar()}
          ${buildSectionNav()}
          ${buildBasicSection()}
          ${buildDNSSection()}
          ${buildProviderSection()}
          ${buildRuleProviderSection()}
          ${buildRulesSection()}
          ${buildCustomSection()}
          ${buildProxyGroupSection()}
          ${buildRawEditSection()}
          ${buildTips()}
        </div>
      </div>
    </div>
  `);

  collapseGen('#mmce_collapse_btn', '#mmce_collapse', '#mmce_collapse', () => {});

  // Bind events
  document.querySelectorAll(`.${PLUGIN_PREFIX}nav_btn`).forEach(btn => { btn.addEventListener('click', () => showSection(btn.dataset.section)); });

  document.getElementById(`${PLUGIN_PREFIX}btn_load`).addEventListener('click', async () => {
    if (!(await checkAdvanceFunc())) return createToast('请先启用高级功能', 'red');
    if (state.isDirty && !(await editorAskConfirm('未保存的修改', '当前有未保存的修改，重新加载会丢失，确定继续吗？'))) return;
    createToast('正在读取配置...', 'yellow');
    try {
      const text = await loadConfigFromDevice();
      parseConfig(text); renderAllSections(); updateStatus();
      if (state.parseError) { showSection('raw'); createToast('配置解析失败，已进入原始编辑模式，可手动修复', 'red', 6000); }
      else { showSection('basic'); createToast('配置加载成功', 'green'); }
    } catch (e) { createToast('加载失败: ' + e.message, 'red'); }
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_import`).addEventListener('click', () => { document.getElementById(`${PLUGIN_PREFIX}file_input`).click(); });

  document.getElementById(`${PLUGIN_PREFIX}file_input`).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (state.isDirty && !(await editorAskConfirm('未保存的修改', '当前有未保存的修改，导入新配置会覆盖，确定继续吗？'))) { e.target.value = ''; return; }
    try {
      const text = await file.text(); parseConfig(text); renderAllSections(); updateStatus();
      if (state.parseError) { showSection('raw'); createToast('配置解析失败，已进入原始编辑模式，可手动修复', 'red', 6000); }
      else { showSection('basic'); createToast('配置导入成功', 'green'); }
    } catch (err) { createToast('导入失败: ' + err.message, 'red'); }
    e.target.value = '';
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_export`).addEventListener('click', () => { if (!state.loaded) return createToast('请先加载或导入配置', 'red'); exportConfig(); });

  document.getElementById(`${PLUGIN_PREFIX}btn_save`).addEventListener('click', async () => {
    if (!state.loaded) return createToast('请先加载或导入配置', 'red');
    if (!(await checkAdvanceFunc())) return createToast('请先启用高级功能', 'red');
    let configText = state.rawEditMode ? (document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value || state.rawText) : rebuildConfigText();
    const check = validateConfig(configText);
    if (!check.valid && !(await editorAskConfirm('配置验证未通过', '验证失败：' + check.error + '\n\n是否仍要强制保存？（可能导致猫猫内核启动失败）'))) return;
    if (check.valid) createToast('配置验证通过', 'green', 2000);
    if (!(await editorAskConfirm('保存并重启', '确定要保存当前配置并重启猫猫内核吗？保存前会自动备份原配置到 uploads 目录。'))) return;
    try {
      createToast('正在保存配置...', 'yellow');
      if (state.rawEditMode) {
        state.rawText = configText; const ts = Date.now();
        await runShellWithRoot(`cp ${CONFIG_PATH} ${UPLOAD_DIR}/mm_config_backup_${ts}.yaml`);
        const tempFile = `${UPLOAD_DIR}/mm_config_temp_${ts}.yaml`;
        await runShellWithRoot(`cat > ${tempFile} << 'YAMLEOF'\n${configText}\nYAMLEOF`);
        await runShellWithRoot(`mv ${tempFile} ${CONFIG_PATH}`);
      } else { await saveConfigToDevice(); }
      createToast('配置已保存，正在重启内核...', 'green', 5000);
      await restartClash(); state.isDirty = false;
      try { parseConfig(configText); renderAllSections(); } catch (_) {}
      updateStatus();
    } catch (e) { createToast('保存失败: ' + e.message, 'red'); }
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_backup`).addEventListener('click', async () => {
    if (!(await checkAdvanceFunc())) return createToast('请先启用高级功能', 'red'); await backupConfig();
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_raw`).addEventListener('click', () => {
    if (!state.loaded) return createToast('请先加载配置', 'red');
    const text = state.rawEditMode ? (document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value || state.rawText) : rebuildConfigText();
    const { el, close } = createFixedToast(PLUGIN_PREFIX + 'raw_view', `<div style="pointer-events:all;width:90vw;max-width:800px;"><div class="title" style="margin:0">原始配置预览（YAML）${state.rawEditMode ? ' - 原始编辑模式' : ''}</div><textarea readonly style="width:100%;height:60vh;margin-top:10px;background:#000;color:#0f0;font-family:monospace;font-size:.7rem;border:1px solid #333;border-radius:6px;padding:8px;box-sizing:border-box;">${escapeHtml(text)}</textarea><div style="text-align:right;margin-top:8px;"><button class="cancel" style="font-size:.7rem">关闭</button></div></div>`);
    el.querySelector('.cancel')?.addEventListener('click', close);
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_validate`).addEventListener('click', () => {
    if (!state.loaded) return createToast('请先加载或导入配置', 'red');
    const text = state.rawEditMode ? (document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value || state.rawText) : rebuildConfigText();
    const check = validateConfig(text);
    if (check.valid) createToast('✅ 配置验证通过，YAML 结构合法', 'green', 4000);
    else createToast('❌ 验证失败：' + check.error, 'red', 6000);
  });

  const rawEditor = document.getElementById(`${PLUGIN_PREFIX}raw_editor`);
  if (rawEditor) { rawEditor.addEventListener('input', () => { rawEditor.dataset.touched = '1'; state.isDirty = true; state.rawEditMode = true; updateStatus(); }); }

  document.getElementById(`${PLUGIN_PREFIX}btn_reparse`).addEventListener('click', () => {
    const text = document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value;
    if (!text) return createToast('编辑器内容为空', 'red');
    const check = validateConfig(text);
    if (!check.valid) { createToast('解析失败：' + check.error + '，请检查 YAML 格式', 'red', 6000); state.parseError = check.error; state.rawText = text; updateStatus(); return; }
    parseConfig(text);
    const editor = document.getElementById(`${PLUGIN_PREFIX}raw_editor`);
    if (editor) delete editor.dataset.touched;
    renderAllSections(); updateStatus(); showSection('basic');
    createToast('✅ 解析成功，已恢复可视化编辑模式', 'green', 4000);
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_validate_raw`).addEventListener('click', () => {
    const text = document.getElementById(`${PLUGIN_PREFIX}raw_editor`)?.value || '';
    const check = validateConfig(text);
    if (check.valid) createToast('✅ YAML 格式正确', 'green', 3000);
    else createToast('❌ ' + check.error, 'red', 5000);
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_add_provider`).addEventListener('click', async () => {
    const name = prompt('请输入订阅名称（如 provider3）：'); if (!name) return;
    if (state.parsed['proxy-providers']?.[name]) return createToast('该名称已存在', 'red');
    const url = prompt('请输入订阅链接：'); if (!url) return;
    if (!state.parsed['proxy-providers']) state.parsed['proxy-providers'] = {};
    state.parsed['proxy-providers'][name] = { type: 'http', url, path: `./proxies/${name}.yaml`, interval: 3600, 'health-check': { enable: true, interval: 900, url: 'https://www.gstatic.com/generate_204' } };
    renderProvidersSection(); markDirty(); createToast('订阅已添加', 'green');
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_add_rule_provider`).addEventListener('click', async () => {
    const name = prompt('请输入规则集名称（如 myRules）：'); if (!name) return;
    if (state.parsed['rule-providers']?.[name]) return createToast('该名称已存在', 'red');
    const behavior = prompt('请输入行为类型（domain / ipcidr / classical）：', 'domain'); if (!behavior) return;
    const url = prompt('请输入规则集URL（可选，本地文件可留空）：') || '';
    if (!state.parsed['rule-providers']) state.parsed['rule-providers'] = {};
    state.parsed['rule-providers'][name] = { behavior, format: behavior === 'classical' ? 'yaml' : 'mrs', type: url ? 'http' : 'file', path: `./rules/${name}.${behavior === 'classical' ? 'yaml' : 'mrs'}`, interval: 86400 };
    if (url) state.parsed['rule-providers'][name].url = url;
    renderRuleProvidersSection(); markDirty(); createToast('规则集已添加', 'green');
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_add_rule`).addEventListener('click', async () => {
    const rule = prompt('请输入规则（如 DOMAIN-SUFFIX,google.com,选择节点）：'); if (!rule) return;
    if (!Array.isArray(state.parsed['rules'])) state.parsed['rules'] = [];
    state.parsed['rules'].push(rule); renderRulesSection(); markDirty(); createToast('规则已添加', 'green');
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_add_group`).addEventListener('click', async () => {
    const name = prompt('请输入代理组名称：'); if (!name) return;
    if (!Array.isArray(state.parsed['proxy-groups'])) state.parsed['proxy-groups'] = [];
    state.parsed['proxy-groups'].push({ name, type: 'select', proxies: ['DIRECT'] });
    renderProxyGroupsSection(); markDirty(); createToast('代理组已添加', 'green');
  });

  document.getElementById(`${PLUGIN_PREFIX}btn_add_custom`).addEventListener('click', () => {
    const type = document.getElementById(`${PLUGIN_PREFIX}custom_type`).value;
    const value = document.getElementById(`${PLUGIN_PREFIX}custom_value`).value.trim();
    const policy = document.getElementById(`${PLUGIN_PREFIX}custom_policy`).value;
    if (!value) return createToast('请输入内容', 'red');
    let rule;
    if (type === 'domain') rule = `DOMAIN-SUFFIX,${value},${policy}`;
    else if (type === 'ip') rule = `IP-CIDR,${value},${policy},no-resolve`;
    else if (type === 'keyword') rule = `DOMAIN-KEYWORD,${value},${policy}`;
    state.customRules.push(rule);
    document.getElementById(`${PLUGIN_PREFIX}custom_value`).value = '';
    renderCustomSection(); renderRulesSection(); markDirty();
    createToast('自定义规则已添加', 'green');
  });

  showSection('basic');
  updateStatus();
  createToast('🎛️ 可视化配置编辑器已加载，点击「读取当前配置」开始使用', 'green', 4000);
}
})();
//</script >
