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


/**
 * Build an Xray config for a 2-hop proxy chain.
 *
 * Data flow:
 *   Client → [proxy-hop1 outbound] → Hop1 server → [proxy-hop2 outbound] → Hop2 server → Internet
 *
 * Xray mechanism: dialerProxy
 *   - proxy-hop2 has  sockopt.dialerProxy = "proxy-hop1"
 *     → its TCP/UDP connection is made *through* the hop1 outbound
 *   - proxy-hop1 has  sockopt.dialerProxy = "direct"   (normal behaviour)
 *
 * The resulting outbounds array is:
 *   [ proxy-hop2 (tagged "proxy"),  proxy-hop1 (tagged "proxy-hop1"),  freedom "direct" ]
 *
 * The routing rule sends all traffic to "proxy" (hop2), which in turn
 * dials through hop1 automatically.
 */
function convert_chain_uris_to_xray_json(hop1Uri, hop2Uri, optional_settings) {
    // Parse each hop individually — reuse existing single-URI logic
    const hop1ConfigStr = convert_uri_to_xray_json(hop1Uri, optional_settings);
    const hop2ConfigStr = convert_uri_to_xray_json(hop2Uri, optional_settings);

    let hop1Config, hop2Config;
    try { hop1Config = JSON.parse(hop1ConfigStr); } catch(e) { return hop1ConfigStr; }
    try { hop2Config = JSON.parse(hop2ConfigStr); } catch(e) { return hop2ConfigStr; }

    if (hop1Config.error) return hop1ConfigStr;
    if (hop2Config.error) return hop2ConfigStr;

    // Extract the outbound objects parsed by convert_uri_to_xray_json
    // (first element is always the proxy outbound)
    const hop1Out = hop1Config.outbounds[0];
    const hop2Out = hop2Config.outbounds[0];

    // Tag the two hops distinctly
    hop1Out.tag = "proxy-hop1";
    hop2Out.tag = "proxy";

    // Hop1 dials directly to the internet
    hop1Out.streamSettings = hop1Out.streamSettings || {};
    hop1Out.streamSettings.sockopt = hop1Out.streamSettings.sockopt || {};
    hop1Out.streamSettings.sockopt.mark = 255;
    hop1Out.streamSettings.sockopt.dialerProxy = "direct";

    // Hop2 dials through hop1
    hop2Out.streamSettings = hop2Out.streamSettings || {};
    hop2Out.streamSettings.sockopt = hop2Out.streamSettings.sockopt || {};
    hop2Out.streamSettings.sockopt.mark = 255;
    hop2Out.streamSettings.sockopt.dialerProxy = "proxy-hop1";

    // Use the full config skeleton from hop2 (has correct dns/routing from settings)
    // but replace outbounds with our chained pair
    const fullConfig = hop2Config;
    fullConfig.outbounds = [
        hop2Out,
        hop1Out,
        {
            protocol: "freedom",
            tag: "direct",
            streamSettings: {
                sockopt: { mark: 255 }
            }
        }
    ];

    return JSON.stringify(fullConfig, null, 2);
}

function convert_uri_to_xray_json(uri, optional_settings) {
    const settings = optional_settings || {
        loglevel: "none",
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
        dnsViaProxy: true,
        localDns: false,
        fakeDnsLocal: false,
        vpnDns: "1.1.1.1",
        foreignDns: "1.1.1.1",
        domesticDns: "223.5.5.5"
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

            const vmessNet = c.net || "tcp";

            if (vmessNet === 'tcp') {
                if (c.type && c.type !== 'none') {
                    const tcpHeader = { type: c.type };
                    if (c.type === 'http') {
                        tcpHeader.request = {
                            path: c.path ? c.path.split(',') : ["/"],
                            headers: c.host ? { Host: c.host.split(',') } : {}
                        };
                    }
                    outbound.streamSettings.tcpSettings = { header: tcpHeader };
                }
            } else if (vmessNet === 'kcp' || vmessNet === 'mkcp') {
                outbound.streamSettings.kcpSettings = {
                    header: { type: c.type || "none" },
                    ...(c.seed ? { seed: c.seed } : {})
                };
            } else if (vmessNet === 'ws') {
                outbound.streamSettings.wsSettings = {
                    path: c.path || "/",
                    headers: { Host: c.host || "" }
                };
            } else if (vmessNet === 'httpupgrade') {
                outbound.streamSettings.httpupgradeSettings = {
                    path: c.path || "/",
                    host: c.host || ""
                };
            } else if (vmessNet === 'xhttp' || vmessNet === 'splithttp') {
                const xhttpSettings = {
                    path: c.path || "/",
                    host: c.host || ""
                };
                if (c.mode && c.mode !== 'auto') xhttpSettings.mode = c.mode;
                if (c.extra) { try { Object.assign(xhttpSettings, typeof c.extra === 'string' ? JSON.parse(c.extra) : c.extra); } catch(e) {} }
                outbound.streamSettings.xhttpSettings = xhttpSettings;
            } else if (vmessNet === 'h2' || vmessNet === 'http') {
                outbound.streamSettings.httpSettings = {
                    path: c.path || "/",
                    host: c.host ? c.host.split(',').map(h => h.trim()) : []
                };
            } else if (vmessNet === 'grpc') {
                outbound.streamSettings.grpcSettings = {
                    serviceName: c.path || "",
                    multiMode: c.mode === 'multi',
                    ...(c.authority ? { authority: c.authority } : {})
                };
            } else if (vmessNet === 'quic') {
                outbound.streamSettings.quicSettings = {
                    header: { type: c.type || "none" }
                };
            }
        }
        else if (uri.startsWith('vless://') || uri.startsWith('trojan://')) {
            const proto = uri.startsWith('vless://') ? 'vless' : 'trojan';
            // Fix parser on old Chrome
            const fakeHttpUri = uri.replace(/^(vless|trojan):\/\//i, 'https://');
            const u = new URL(fakeHttpUri);
            const p = new URLSearchParams(u.search);
            const user = decodeURIComponent(u.username);
            const host = u.hostname;
            const port = +u.port || 443;
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
                        fingerprint: p.get('fp') || "chrome",
                        publicKey: p.get('pbk') || "",
                        shortId: p.get('sid') || "",
                        spiderX: p.get('spx') || ""
                    };
                } else {
                    outbound.streamSettings.tlsSettings = {
                        serverName: p.get('sni') || "",
                        alpn: p.get('alpn') ? p.get('alpn').split(',') : undefined,
                        fingerprint: p.get('fp') || undefined
                    };
                    if (settings.pinnedPeerCertSha256) {
                        outbound.streamSettings.tlsSettings.pinnedPeerCertSha256 = [settings.pinnedPeerCertSha256];
                    }
                }
            }

            if (net === 'tcp') {
                const headerType = p.get('headerType') || 'none';
                if (headerType && headerType !== 'none') {
                    const tcpHeader = { type: headerType };
                    if (headerType === 'http') {
                        const httpPath = p.get('path') || '/';
                        const httpHost = p.get('host') || '';
                        tcpHeader.request = {
                            path: httpPath.split(','),
                            headers: httpHost ? { Host: httpHost.split(',') } : {}
                        };
                    }
                    outbound.streamSettings.tcpSettings = { header: tcpHeader };
                }
            } else if (net === 'kcp' || net === 'mkcp') {
                outbound.streamSettings.kcpSettings = {
                    header: { type: p.get('headerType') || 'none' },
                    ...(p.get('seed') ? { seed: p.get('seed') } : {})
                };
            } else if (net === 'ws') {
                outbound.streamSettings.wsSettings = {
                    path: p.get('path') || "/",
                    host: p.get('host') || ""
                };
            } else if (net === 'httpupgrade') {
                outbound.streamSettings.httpupgradeSettings = {
                    path: p.get('path') || "/",
                    host: p.get('host') || ""
                };
            } else if (net === 'xhttp' || net === 'splithttp') {
                const xhttpSettings = {
                    path: p.get('path') || "/",
                    host: p.get('host') || ""
                };
                const mode = p.get('mode');
                if (mode && mode !== 'auto') xhttpSettings.mode = mode;
                const extra = p.get('extra');
                if (extra) { try { Object.assign(xhttpSettings, JSON.parse(extra)); } catch(e) {} }
                outbound.streamSettings.xhttpSettings = xhttpSettings;
            } else if (net === 'h2' || net === 'http') {
                outbound.streamSettings.httpSettings = {
                    path: p.get('path') || "/",
                    host: p.get('host') ? p.get('host').split(',').map(h => h.trim()) : []
                };
            } else if (net === 'grpc') {
                outbound.streamSettings.grpcSettings = {
                    serviceName: p.get('serviceName') || p.get('path') || "",
                    multiMode: p.get('mode') === 'multi',
                    ...(p.get('authority') ? { authority: p.get('authority') } : {})
                };
            }
        }
        else if (uri.startsWith('ss://') || uri.startsWith('shadowsocks://')) {
            // Extract user info portion (before the @)
            const atIdx = uri.indexOf('@');
            if (atIdx === -1) throw new Error("Invalid Shadowsocks URI: missing @");
            const schemeEnd = uri.indexOf('://') + 3;
            const rawUserPart = uri.substring(schemeEnd, atIdx);
            // Try base64-decode first; fall back to plain text
            let method, password;
            try {
                const decoded = decodeBase64(rawUserPart);
                if (decoded && decoded.includes(':')) {
                    const ci = decoded.indexOf(':');
                    method = decoded.substring(0, ci);
                    password = decoded.substring(ci + 1);
                } else {
                    throw new Error("not base64 method:pass");
                }
            } catch {
                // Plain-text method:password (URL-encoded)
                const plain = decodeURIComponent(rawUserPart);
                const ci = plain.indexOf(':');
                method = ci !== -1 ? plain.substring(0, ci) : plain;
                password = ci !== -1 ? plain.substring(ci + 1) : "";
            }
            // Parse host:port from after-@ portion (strip fragment/query)
            let hostPort = uri.substring(atIdx + 1).replace(/#.*$/, '').replace(/\?.*$/, '');
            const lastColon = hostPort.lastIndexOf(':');
            const ssHost = hostPort.substring(0, lastColon);
            const ssPort = parseInt(hostPort.substring(lastColon + 1)) || 443;

            outbound = {
                tag: "proxy",
                protocol: "shadowsocks",
                settings: {
                    servers: [{
                        address: ssHost,
                        port: ssPort,
                        method: method,
                        password: password || ""
                    }]
                },
                streamSettings: {
                    network: "tcp",
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };
        }
        else if (uri.startsWith('wg://') || uri.startsWith('wireguard://')) {
            // Fix parser on old Chrome
            const fakeHttpUri = uri.replace(/^(wg|wireguard):\/\//i, 'https://');
            const u = new URL(fakeHttpUri);
            const p = new URLSearchParams(u.search);
            
            outbound = {
                tag: "proxy",
                protocol: "wireguard",
                settings: {
                    secretKey: decodeURIComponent(u.username + (u.password ? ':' + u.password : '')),
                    peers: [{
                        endpoint: `${u.hostname}:${u.port || 443}`,
                        publicKey: p.get('publickey') || p.get('public_key') || p.get('pk') || "",
                        ...(p.get('presharedkey') || p.get('preshared_key') ? {
                            preSharedKey: p.get('presharedkey') || p.get('preshared_key')
                        } : {})
                    }],
                    mtu: parseInt(p.get('mtu')) || settings.mtu || 1420,
                    address: p.get('address') ? p.get('address').split(',') : ["10.0.0.2/32"]
                },
                streamSettings: {
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };
            if (p.get('reserved')) {
                try {
                    outbound.settings.reserved = JSON.parse(p.get('reserved'));
                } catch {
                    outbound.settings.reserved = p.get('reserved').split(',').map(Number);
                }
            }
        }
        else if (uri.startsWith('hy2://') || uri.startsWith('hysteria2://')) {
            // Fix parser on old Chrome
            const fakeHttpUri = uri.replace(/^(hy2|hysteria2):\/\//i, 'https://');
            const u = new URL(fakeHttpUri);
            const p = new URLSearchParams(u.search);

            const hy2Server = {
                address: u.hostname,
                port: +u.port || 443
            };
            // Port hopping: mport param (e.g. "20000-30000")
            if (p.get('mport')) {
                hy2Server.ports = p.get('mport');
            }

            const hy2Settings = {
                servers: [hy2Server],
                auth: decodeURIComponent(u.username)
            };
            // hopInterval (seconds) for port hopping
            if (p.get('hopInterval')) {
                hy2Settings.hopInterval = parseInt(p.get('hopInterval')) || 30;
            }
            // Bandwidth hints
            if (p.get('down') || p.get('bandwidth')) {
                hy2Settings.downlinkCapacity = p.get('down') || p.get('bandwidth');
            }
            if (p.get('up')) {
                hy2Settings.uplinkCapacity = p.get('up');
            }

            outbound = {
                tag: "proxy",
                protocol: "hysteria2",
                settings: hy2Settings,
                streamSettings: {
                    network: "udp",
                    security: "tls",
                    tlsSettings: {
                        serverName: p.get('sni') || u.hostname
                    },
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };
            if (p.get('obfs') && p.get('obfs') !== 'none') {
                outbound.settings.obfs = {
                    type: p.get('obfs'),
                    password: p.get('obfs-password') || ""
                };
            }
        }
        else if (uri.startsWith('socks://') || uri.startsWith('socks5://')) {
            // Fix parser on old Chrome
            const fakeHttpUri = uri.replace(/^(socks5|socks):\/\//i, 'https://');
            const u = new URL(fakeHttpUri);
            
            outbound = {
                tag: "proxy",
                protocol: "socks",
                settings: {
                    servers: [{
                        address: u.hostname,
                        port: +u.port || 443,
                        users: u.username ? [{
                            user: decodeURIComponent(u.username),
                            pass: decodeURIComponent(u.password || "")
                        }] : undefined
                    }]
                },
                streamSettings: {
                    network: "tcp",
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };
        }
        else if (uri.startsWith('http://') || uri.startsWith('https://')) {
            const u = new URL(uri);
            
            outbound = {
                tag: "proxy",
                protocol: "http",
                settings: {
                    servers: [{
                        address: u.hostname,
                        port: +u.port || (u.protocol === 'https:' ? 443 : 80),
                        users: u.username ? [{
                            user: decodeURIComponent(u.username),
                            pass: decodeURIComponent(u.password || "")
                        }] : undefined
                    }]
                },
                streamSettings: {
                    network: "tcp",
                    security: u.protocol === 'https:' ? "tls" : "none",
                    sockopt: { mark: 255, "dialerProxy": "direct" }
                }
            };
            if (u.protocol === 'https:') {
                outbound.streamSettings.tlsSettings = {
                    serverName: u.hostname
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

    // Resolve effective fakeip flag — new field (fakeDnsLocal) takes priority when
    // Local DNS is enabled; fall back to legacy fakeDns for backward compatibility.
    const useFakeIp = settings.localDns
        ? settings.fakeDnsLocal
        : false;

    let dnsServers;

    if (settings.localDns) {
        // Build a structured DNS server list from the explicit fields.
        dnsServers = [];

        // 1. FakeIP entry — sits first so it intercepts all domain queries.
        if (useFakeIp) {
            dnsServers.push({
                address: "fakeip",
                domains: ["regexp:.+"],
                expectIPs: ["geoip:!private"]
            });
        }

        // 2. VPN DNS — only included when FakeIP is NOT active (grayed out in UI when FakeIP is on).
        if (!useFakeIp && settings.vpnDns && settings.vpnDns.trim()) {
            dnsServers.push({
                address: settings.vpnDns.trim(),
                domains: ["regexp:.+"]
            });
        }

        // 3. Domestic DNS — for local/domestic domain resolution, routed direct.
        if (settings.domesticDns && settings.domesticDns.trim()) {
            dnsServers.push({
                address: settings.domesticDns.trim(),
                domains: ["geosite:cn", "geosite:private"],
                expectIPs: ["geoip:cn", "geoip:private"],
                skipFallback: true
            });
        }

        // 4. Foreign DNS — fallback for everything else.
        if (settings.foreignDns && settings.foreignDns.trim()) {
            dnsServers.push(settings.foreignDns.trim());
        }

        // Ensure there is always at least one server so Xray doesn't error out.
        if (dnsServers.length === 0) {
            dnsServers.push("1.1.1.1");
        }
    } else {
        // Legacy / simple mode: two hardcoded servers, optional fakeip prepend.
        dnsServers = ["1.1.1.1", "8.8.8.8"];
        if (useFakeIp) {
            dnsServers.unshift({
                address: "fakeip",
                domains: ["regexp:.+"],
                expectIPs: ["geoip:!private"]
            });
        }
    }

    const fullConfig = {
        log: { 
            loglevel: settings.loglevel || "none" 
        }, 
        dns: {
            servers: dnsServers,
            queryStrategy: settings.preferIpv6 ? "UseIPv6" : "UseIPv4",
            ...(useFakeIp ? { fakedns: [{ ipPool: "198.18.0.0/15", poolSize: 65535 }] } : {})
        },
        inbounds: [
            {
                "tag": "socks-test-in",
                "port": 808,
                "listen": "127.17.1.3",
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
            "domainStrategy": useFakeIp ? "AsIs" : "IPIfNonMatch",
            "rules": [
                // WireGuard needs to resolve its peer endpoint before the tunnel is up.
                // Xray's internal DNS for this comes from xray.system.* (no inboundTag),
                // so the inboundTag-scoped DNS rule below won't catch it.
                // Force all port-53 traffic with no inboundTag straight to direct so
                // WireGuard can resolve its endpoint without looping through itself.
                ...(outbound.protocol === 'wireguard' ? [{
                    "type": "field",
                    "port": 53,
                    "outboundTag": "direct"
                }] : []),
                {
                    "type": "field",
                    "inboundTag": [
                        "socks-test-in",
                    ],
                    "port": 53,
                    "outboundTag": dnsOutboundTag
                },
                ...(useFakeIp ? [{
                    "type": "field",
                    "ip": ["198.18.0.0/15"],
                    "outboundTag": "proxy"
                }] : []),
                {
                    "type": "field",
                    "ip": [
                        "geoip:private"
                    ],
                    "domain": [
                        "geosite:private"
                    ],
                    "outboundTag": "direct"
                },
                {
                    "type": "field",
                    "inboundTag": [
                        "socks-test-in",
                    ],
                    "network": "tcp,udp",
                    "outboundTag": "proxy"
                }
            ]
        }
    };

    return JSON.stringify(fullConfig, null, 2);
}
