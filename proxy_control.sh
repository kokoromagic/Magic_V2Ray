#!/system/bin/sh
MODDIR=${0%/*}
BINDIR="$MODDIR/bin"
PIDFILE="$MODDIR/run/xray.pid"
TUN2SOCKS_PIDFILE="$MODDIR/run/tun2socks.pid"

PIPE_FILE="$MODDIR/run/control.pipe"
DATADIR="/data/adb/magic_v2ray"
set -x >"$DATADIR/proxy_control.log" 2>&1

# Always using system binaries for critical operations to ensure compatibility and reliability
ip="/system/bin/ip"
iptables="/system/bin/iptables"
ip6tables="/system/bin/ip6tables"

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
    # IPv4
    $iptables -t mangle -D OUTPUT -j XRAY_MARK 2>/dev/null
    $iptables -t mangle -F XRAY_MARK 2>/dev/null
    $iptables -t mangle -X XRAY_MARK 2>/dev/null
    $ip rule del fwmark 1 table 100 priority 1010 2>/dev/null
    # IPv4 hotspot
    $iptables -t mangle -D PREROUTING -i wlan+ -j MARK --set-xmark 1 2>/dev/null
    $iptables -t mangle -D PREROUTING -i ap+ -j MARK --set-xmark 1 2>/dev/null
    $iptables -t mangle -D PREROUTING -i softap+ -j MARK --set-xmark 1 2>/dev/null
    $iptables -D FORWARD -i wlan+ -o xraytun0 -j ACCEPT 2>/dev/null
    $iptables -D FORWARD -i ap+ -o xraytun0 -j ACCEPT 2>/dev/null
    $iptables -D FORWARD -i softap+ -o xraytun0 -j ACCEPT 2>/dev/null
    $iptables -D FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null
    $iptables -t nat -D POSTROUTING -o xraytun0 -j MASQUERADE 2>/dev/null
    # IPv6
    $ip6tables -t mangle -D OUTPUT -j XRAY_MARK 2>/dev/null
    $ip6tables -t mangle -F XRAY_MARK 2>/dev/null
    $ip6tables -t mangle -X XRAY_MARK 2>/dev/null
    $ip -6 rule del fwmark 1 table 100 priority 1010 2>/dev/null
    # IPv6 hotspot
    $ip6tables -t mangle -D PREROUTING -i wlan+ -j MARK --set-xmark 1 2>/dev/null
    $ip6tables -t mangle -D PREROUTING -i ap+ -j MARK --set-xmark 1 2>/dev/null
    $ip6tables -t nat -D POSTROUTING -o xraytun0 -j MASQUERADE 2>/dev/null

    # Down the tun device
    $ip link set dev xraytun0 down 2>/dev/null
}

start_proxy() {
    if get_status; then
        echo "Proxy core is already running with PID $(cat "$PIDFILE")"
        return 0
    fi

    # Start xray core and tun2socks in the background
    echo start > "$PIPE_FILE"

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
    stop) stop_proxy; rm -rf "$DATADIR/config.json" ;;
    restart) stop_proxy; sleep 1; start_proxy ;;
    status)
        if get_status; then
            echo "running"
        else
            echo "stopped"
        fi
        ;;
esac