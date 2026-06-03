SKIPUNZIP=1

mkdir -p "$MODPATH/bin"
mkdir -p "$MODPATH/webroot"

ui_print "- Detected Architecture: $ARCH"

# 2. Extract only the matching binary directly into the module's private directory
case "$ARCH" in
    arm64)
        ui_print "- Extracting Xray-core for arm64-v8a..."
        unzip -j -o "$ZIPFILE" "bin/arm64-v8a/*" -d "$MODPATH/bin"
        ;;
    x64)
        ui_print "- Extracting Xray-core for Android-x86_64..."
        unzip -j -o "$ZIPFILE" "bin/x86_64/*" -d "$MODPATH/bin"
        ;;
    *)
        ui_print "❌ Unsupported CPU architecture: $ARCH"
        abort "Unsupported device target!"
        ;;
esac

# 3. Extract core scripts, webroot UI files and structural assets
ui_print "- Extracting management scripts and Webroot components..."
unzip -o "$ZIPFILE" "webroot/*" -d "$MODPATH/"
unzip -j -o "$ZIPFILE" "proxy_control.sh" -d "$MODPATH"
unzip -j -o "$ZIPFILE" "service.sh" -d "$MODPATH"
unzip -j -o "$ZIPFILE" "action.sh" -d "$MODPATH"
unzip -j -o "$ZIPFILE" "module.prop" -d "$MODPATH"

# 4. Enforce strict executable permissions natively
ui_print "- Setting executable permissions..."
chmod 755 "$MODPATH/bin/"*

ui_print "- Setup /data/adb/magic_v2ray directory"
if [ ! -d "/data/adb/magic_v2ray" ]; then
    rm -rf "/data/adb/magic_v2ray"
    mkdir -p "/data/adb/magic_v2ray"
fi

ui_print "- Setup secret token for files"
RANDOM_TOKEN=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
FILE_ACTION="$MODPATH/action.sh"
FILE_CGI="$MODPATH/webroot/cgi-bin/exec"
FILE_JS="$MODPATH/webroot/main.js"
[ -f "$FILE_ACTION" ] && sed -i "s/__SECRET_TOKEN__/$RANDOM_TOKEN/g" "$FILE_ACTION"
[ -f "$FILE_CGI" ]    && sed -i "s/__SECRET_TOKEN__/$RANDOM_TOKEN/g" "$FILE_CGI"
[ -f "$FILE_JS" ]     && sed -i "s/__SECRET_TOKEN__/$RANDOM_TOKEN/g" "$FILE_JS"
chmod 755 "$FILE_CGI"

ui_print "Magic V2Ray configuration deployment complete!"