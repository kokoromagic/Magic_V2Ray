#!/system/bin/sh
MODDIR=${0%/*}
BINDIR="$MODDIR/bin"

PIDFILE="$MODDIR/run/xray.pid"
TUN2SOCKS_PIDFILE="$MODDIR/run/tun2socks.pid"

# Control pipe for receiving commands from the UI or other components
PIPE_FILE="$MODDIR/run/control.pipe"

rm -rf "$MODDIR/run"
mkdir -p "$MODDIR/run"
mkfifo "$PIPE_FILE"
XRAY_PID=0
TUN2SOCKS_PID=0

do_job() {
    local content="$1"
    if [ "$content" = "start" ]; then
        STAT_XRAY_EXE=$(stat -L -c "%D:%i" "/proc/$XRAY_PID/exe")
        STAT_XRAY_BIN=$(stat -L -c "%D:%i" "$MODDIR/bin/xray")
        if [ $XRAY_PID -gt 0 ] && [ "$STAT_XRAY_EXE" = "$STAT_XRAY_BIN" ]; then
            echo "Xray is already running with PID $XRAY_PID"
        else
            # Start Xray core
            "$BINDIR/xray" run -c "$MODDIR/config.json" </dev/null &>"$MODDIR/xray.log" &
            XRAY_PID=$!
            echo "$XRAY_PID" > "$PIDFILE"
        fi

        STAT_TUN2SOCKS_EXE=$(stat -L -c "%D:%i" "/proc/$TUN2SOCKS_PID/exe")
        STAT_TUN2SOCKS_BIN=$(stat -L -c "%D:%i" "$MODDIR/bin/tun2socks")
        if [ $TUN2SOCKS_PID -gt 0 ] && [ "$STAT_TUN2SOCKS_EXE" = "$STAT_TUN2SOCKS_BIN" ]; then
            echo "tun2socks is already running with PID $TUN2SOCKS_PID"
        else
            # Start tun2socks
            "$BINDIR/tun2socks" -device tun://xraytun0 -proxy socks5://127.0.0.1:10808 -fwmark 255 </dev/null &>"$MODDIR/tun2socks.log" &
            TUN2SOCKS_PID=$!
            echo "$TUN2SOCKS_PID" > "$TUN2SOCKS_PIDFILE"
        fi
    fi
}

{
while true; do
    if read -r line < "$PIPE_FILE"; then
        if [ -n "$line" ]; then
            do_job "$line" &
        fi
    fi
done
} &