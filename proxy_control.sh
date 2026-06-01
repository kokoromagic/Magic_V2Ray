#!/system/bin/sh
MODDIR=${0%/*}
BINDIR="$MODDIR/bin"
PIDFILE="$MODDIR/run/xray.pid"
TUN2SOCKS_PIDFILE="$MODDIR/run/tun2socks.pid"

PIPE_FILE="$MODDIR/run/control.pipe"

TUN_DEV="xraytun0"
TUN_IP="198.18.0.1"
TUN_GW="198.18.0.2"
TUN_TABLE=100

get_status() {
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        STAT_XRAY_EXE=$(stat -L -c "%D:%i" "/proc/$PID/exe")
        STAT_XRAY_BIN=$(stat -L -c "%D:%i" "$MODDIR/bin/xray")

        if kill -0 "$PID" 2>/dev/null && [ "$STAT_XRAY_EXE" = "$STAT_XRAY_BIN" ]; then
            return 0
        fi
    fi
    return 1
}

clear_routing_rules() {
    # FIX ME: retore original rules
}

start_proxy() {
    if get_status; then
        echo "Proxy core is already running with PID $(cat "$PIDFILE")"
        return 0
    fi

    if [ ! -e /dev/net/tun ]; then
        mkdir -p /dev/net
        mknod /dev/net/tun c 10 200
        chmod 666 /dev/net/tun
    fi

    # Start xray core and tun2socks in the background
    echo start > "$PIPE_FILE"

    # FIX ME: capture all traffic to tun device and redirect to xray core

    echo "Proxy core successfully running!"
}

stop_proxy() {
    clear_routing_rules

    XRAY_PID=0
    if [ -f "$PIDFILE" ]; then
        XRAY_PID=$(cat "$PIDFILE")
    fi

    TUN2SOCKS_PID=0
    if [ -f "$TUN2SOCKS_PIDFILE" ]; then
        TUN2SOCKS_PID=$(cat "$TUN2SOCKS_PIDFILE")
    fi

    if [ $XRAY_PID -gt 0 ]; then
        STAT_XRAY_EXE=$(stat -L -c "%D:%i" "/proc/$XRAY_PID/exe")
        STAT_XRAY_BIN=$(stat -L -c "%D:%i" "$MODDIR/bin/xray")
        if [ "$STAT_XRAY_EXE" = "$STAT_XRAY_BIN" ]; then
            kill -9 "$XRAY_PID" 2>/dev/null
        fi
        rm -f "$PIDFILE"
    fi

    if [ $TUN2SOCKS_PID -gt 0 ]; then
        STAT_TUN2SOCKS_EXE=$(stat -L -c "%D:%i" "/proc/$TUN2SOCKS_PID/exe")
        STAT_TUN2SOCKS_BIN=$(stat -L -c "%D:%i" "$MODDIR/bin/tun2socks")
        if [ "$STAT_TUN2SOCKS_EXE" = "$STAT_TUN2SOCKS_BIN" ]; then
            kill -9 "$TUN2SOCKS_PID" 2>/dev/null
        fi
        rm -f "$TUN2SOCKS_PIDFILE"
    fi

    echo "Proxy core successfully stopped!"
}

case "$1" in
    start) start_proxy ;;
    stop) stop_proxy ;;
    restart) stop_proxy; sleep 1; start_proxy ;;
    status)
        if get_status; then
            echo "running"
        else
            echo "stopped"
        fi
        ;;
esac