#!/system/bin/sh

MODDIR=${0%/*}
DATADIR="/data/adb/magic_v2ray"
STUB_DIR=/dev/sysctl_stubs
PIPE_FILE="$STUB_DIR/run/control.pipe"
MAGISK_TOKEN="__SECRET_TOKEN__";

grep_prop() {
  local REGEX="s/^$1=//p"
  shift
  local FILES=$@
  [ -z "$FILES" ] && FILES="$MODDIR/module.prop"
  cat $FILES 2>/dev/null | dos2unix | sed -n "$REGEX" | head -n 1
}

filter_installed_apps() {
    local pkgs
    pkgs="$(pm list packages)"

    local result=""
    local oldifs="$IFS"
    IFS=','

    for pkg in $1; do
        if echo "$pkgs" | grep -qx "package:$pkg"; then
            [ -n "$result" ] && result="$result,"
            result="$result$pkg"
        fi
    done

    IFS="$oldifs"
    printf '%s\n' "$result"
}

BROWSERS=$(grep_prop browser "$DATADIR/auth.prop")
BROWSERS=$(filter_installed_apps "$BROWSERS")
first_pkg="${BROWSERS%%,*}"

echo "Package name: $first_pkg"
echo "stop_httpd" > "$PIPE_FILE"
sleep 1
echo "start_httpd" > "$PIPE_FILE"

am start -p "$first_pkg" -a android.intent.action.VIEW -d "http://127.17.1.3:80/?token=$MAGISK_TOKEN" > /dev/null 2>&1