# Magic V2Ray

[Xem phiên bản Tiếng Việt](./README_vi.md)

A powerful and easy-to-use internet proxy manager for rooted Android devices. It helps you route all device traffic through a proxy server to secure your connection, bypass restrictions, and share your high-speed connection with other devices.

---

## What is Magic V2Ray?

**Magic V2Ray** is an advanced network tool designed for rooted Android phones. By combining top-tier proxy cores, it creates a seamless system-wide connection that covers all your apps. 

It comes with a clean Web UI where you can easily organize your proxy configurations, save your subscription links, and manage your network with a few clicks.

---

## Why Use Magic V2Ray?

If you are used to standard V2Ray apps (like v2rayNG, Matsuri, Nekobox), here is why Magic V2Ray is a game-changer:

- Immortal System-Wide Coverage: Standard apps run in user-space and get easily killed by Android's aggressive memory management, leaking your real IP. Magic V2Ray operates at the kernel level, running silently and invincibly.
- Smart App Isolation (Battery Saver): It separates traffic automatically. Only your user apps (games, social media, browsers) go through the proxy, leaving system processes untouched to prevent overheating and battery drain.
- Seamless Dynamic Reconnects: Instantly detects when you switch between Wi-Fi and 4G/5G, hot-reloading the routing rules without the typical 10-second connection drop found in standard apps.
- Universal Root Support: Works flawlessly out-of-the-box across Magisk, KernelSU, and APatch.

---

## Key Features

- **Category Organizing:** Group your proxy servers into custom folders or categories.
- **Smart Link Import:** Easily paste subscription URLs, raw configuration strings, or mixed text codes.
- **One-Click Auto-Reload:** Saves your subscription links so you can update an entire category with a single tap.
- **No Battery Drain:** Native background processing ensures your battery lasts much longer compared to running heavy standalone VPN apps.

---

## Acknowledgments & Credits

This project uses pre-built binaries from the following open-source projects:
* **[Xray-core](https://github.com/XTLS/Xray-core):** The underlying engine that handles next-generation proxy protocols.
* **[tun2socks](https://github.com/xjasonlyu/tun2socks):** A high-performance utility used to wrap proxy channels into a virtual network interface.