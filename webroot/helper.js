// Helper to decode Base64 safely for both Browser and Node.js environments
function decodeBase64(str) {
    str = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf-8');
    }
    return decodeURIComponent(atob(str).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function utoa(str) {
    const bytes = new TextEncoder().encode(str);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString);
}

function convert_uri_to_xray_json(uri, optional_settings) {
    const settings = optional_settings || {
        loglevel: "debug",
        sniffing: true,
        routeOnly: false,
        preferIpv6: false,
        mux: false,
        mux_connections: 8,
        fragment: false,
        fragment_packets: "tlshello",
        fragment_length: "50-100",
        fragment_interval: "10-20",
        mtu: 1350,
        pinnedPeerCertSha256: "",
        dnsViaProxy: true
    };

    const b64decode = s => {
        try { 
            return decodeURIComponent(escape(atob(s.trim()))); 
        } catch { 
            return null; 
        }
    };

    let outbound = null;
    uri = uri.trim();

    try {
        if (uri.startsWith('vmess://')) {
            const c = JSON.parse(b64decode(uri.substring(8)));
            if (!c) throw new Error("Cannot parse VMESS Base64");
            
            outbound = {
                tag: "proxy",
                protocol: "vmess",
                settings: {
                    vnext: [{
                        address: c.add,
                        port: +c.port,
                        users: [{ 
                            id: c.id, 
                            alterId: +c.aid || 0 
                        }]
                    }]
                },
                streamSettings: {
                    network: c.net || "tcp",
                    security: c.tls || "none",
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };

            if (c.tls === 'tls') {
                outbound.streamSettings.tlsSettings = {
                    serverName: c.sni || "",
                    alpn: c.alpn ? c.alpn.split(',') : undefined
                };
                if (settings.pinnedPeerCertSha256) {
                    outbound.streamSettings.tlsSettings.pinnedPeerCertSha256 = [settings.pinnedPeerCertSha256];
                }
            }
            if (c.net === 'ws') {
                outbound.streamSettings.wsSettings = {
                    path: c.path || "/",
                    headers: { Host: c.host || "" }
                };
            }
            if (c.net === 'grpc') {
                outbound.streamSettings.grpcSettings = {
                    serviceName: c.path || ""
                };
            }
        }
        else if (uri.startsWith('vless://') || uri.startsWith('trojan://')) {
            const proto = uri.startsWith('vless://') ? 'vless' : 'trojan';
            const u = new URL(uri);
            const p = new URLSearchParams(u.search);
            const user = decodeURIComponent(u.username);
            const host = u.hostname;
            const port = +u.port;
            const net = p.get('type') || 'tcp';
            const sec = p.get('security') || 'none';

            outbound = {
                tag: "proxy",
                protocol: proto,
                settings: proto === 'trojan' 
                    ? { servers: [{ address: host, port, password: user }] }
                    : { vnext: [{ address: host, port, users: [{ id: user, encryption: "none", flow: p.get('flow') || undefined }] }] },
                streamSettings: { 
                    network: net, 
                    security: sec,
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };

            if (sec === 'tls' || sec === 'reality') {
                if (sec === 'reality') {
                    outbound.streamSettings.realitySettings = {
                        serverName: p.get('sni') || "",
                        alpn: p.get('alpn') ? p.get('alpn').split(',') : undefined
                    };
                } else {
                    outbound.streamSettings.tlsSettings = {
                        serverName: p.get('sni') || "",
                        alpn: p.get('alpn') ? p.get('alpn').split(',') : undefined
                    };
                    if (settings.pinnedPeerCertSha256) {
                        outbound.streamSettings.tlsSettings.pinnedPeerCertSha256 = [settings.pinnedPeerCertSha256];
                    }
                }
            }
            if (net === 'ws') {
                outbound.streamSettings.wsSettings = {
                    path: p.get('path') || "/",
                    headers: { Host: p.get('host') || "" }
                };
            }
            if (net === 'grpc') {
                outbound.streamSettings.grpcSettings = {
                    serviceName: p.get('serviceName') || p.get('path') || ""
                };
            }
        }
    } catch (e) {
        return JSON.stringify({ error: "Unable to parse URI: " + e.message }, null, 2);
    }

    if (!outbound) {
        return JSON.stringify({ error: "Unsupported or malformed URI" }, null, 2);
    }

    if (settings.mux) {
        outbound.streamSettings.mux = {
            enabled: true,
            concurrency: parseInt(settings.mux_connections) || 8
        };
    }

    if (settings.fragment) {
        outbound.streamSettings.sockopt.fragment = {
            packets: settings.fragment_packets || "tlshello",
            length: settings.fragment_length || "50-100",
            interval: settings.fragment_interval || "10-20"
        };
    }

    const dnsOutboundTag = settings.dnsViaProxy ? "proxy" : "direct";

    const fullConfig = {
        log: { 
            loglevel: settings.loglevel || "debug" 
        }, 
        dns: {
            servers: [
                "1.1.1.1",
                "8.8.8.8"
            ],
            queryStrategy: settings.preferIpv6 ? "UseIPv6" : "UseIPv4"
        },
        inbounds: [
            {
                "tag": "socks-test-in",
                "port": 10808,
                "listen": "127.0.0.1",
                "protocol": "socks",
                "settings": {
                    "auth": "noauth",
                    "udp": true
                },
                "sniffing": {
                    "enabled": settings.sniffing,
                    "destOverride": ["http", "tls", "quic"],
                    "routeOnly": settings.routeOnly
                }
            },
            {
                "tag": "http-test-in",
                "port": 10809,
                "listen": "127.0.0.1",
                "protocol": "http",
                "settings": {
                    "allowTransparent": false
                }
            }
        ],
        outbounds: [
            outbound, 
            { 
                "protocol": "freedom", 
                "tag": "direct",
                "streamSettings": {
                    "sockopt": { 
                        mark: 255
                    }
                }
            }
        ],
        routing: {
            "domainStrategy": "IPIfNonMatch",
            "rules": [
                {
                    "type": "field",
                    "inboundTag": [
                        "socks-test-in",
                        "http-test-in",
                    ],
                    "port": 53,
                    "outboundTag": dnsOutboundTag
                },
                {
                    "type": "field",
                    "inboundTag": [
                        "socks-test-in",
                        "http-test-in",
                    ],
                    "network": "tcp,udp",
                    "outboundTag": "proxy"
                }
            ]
        }
    };

    return JSON.stringify(fullConfig, null, 2);
}