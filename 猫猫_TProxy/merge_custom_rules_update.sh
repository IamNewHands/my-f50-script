#!/system/bin/sh
Module_dir=/data/clash
CLASH_CONFIG="$Module_dir/Proxy/config.yaml"
yq_path="$Module_dir/Tools/yq_linux_arm64"
CUSTOM_RULES_FILE="$Module_dir/Proxy/custom_rules.yaml"
COUNTER_FILE="$Module_dir/Proxy/.custom_rules_count"
CFG="$CLASH_CONFIG"

# 步骤1：删除上次合并的 PREV 条规则
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

grep -v '^\s*#' "$CUSTOM_RULES_FILE" | grep -v '^\s*$' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^/    - /' > "$CFG.tmp_rules" 2>/dev/null

COUNT=$(wc -l < "$CFG.tmp_rules" 2>/dev/null || echo 0)
if [ "$COUNT" -eq 0 ]; then
    rm -f "$COUNTER_FILE" "$CFG.tmp_rules"
    return 0 2>/dev/null || exit 0
fi

sed -i '/^rules:/r '"$CFG.tmp_rules" "$CFG" 2>/dev/null
rm -f "$CFG.tmp_rules"
echo "$COUNT" > "$COUNTER_FILE"

return 0 2>/dev/null || exit 0