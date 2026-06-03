#!/system/bin/sh

MODDIR=${0%/*}
PORT=11701
TOKEN="__SECRET_TOKEN__"
WEBROOT="$MODDIR/webroot"

if ! pgrep -f "httpd -p $PORT" > /dev/null; then
    httpd -p $PORT -h "$WEBROOT"
fi

am start -a android.intent.action.VIEW -d "http://127.0.0.1:$PORT/?token=$TOKEN" > /dev/null 2>&1