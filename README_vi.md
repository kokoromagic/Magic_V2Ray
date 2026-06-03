# Magic V2Ray

Một công cụ quản lý proxy Internet mạnh mẽ và dễ sử dụng dành cho các thiết bị Android đã root. Dự án giúp bạn định tuyến toàn bộ lưu lượng mạng của thiết bị qua một proxy server để bảo mật kết nối, vượt tường lửa, đồng thời chia sẻ kết nối tốc độ cao này cho các thiết bị khác.

---

## Magic V2Ray là gì?

**Magic V2Ray** là một công cụ mạng nâng cao được thiết kế riêng cho điện thoại Android đã root. Bằng cách kết hợp các lõi proxy hàng đầu hiện nay, dự án tạo ra một kết nối mượt mà xuyên suốt toàn hệ thống và bao phủ mọi ứng dụng của bạn.

Dự án đi kèm với một giao diện Web UI tối giản, nơi bạn có thể dễ dàng sắp xếp các cấu hình proxy, lưu trữ các liên kết đăng ký (subscription) và quản lý mạng lưới của mình chỉ với vài cú click.

---

## Vì sao nên dùng Magic V2Ray?

Nếu bạn đã quen dùng các app V2Ray thông thường (như v2rayNG, Matsuri, Nekobox), đây là lý do Magic V2Ray là một sự nâng cấp hoàn toàn khác biệt:

- Bao phủ toàn hệ thống (Bất tử): Các app thông thường chạy ở không gian người dùng, dễ bị Android "giết" ngầm khi thiếu RAM hoặc bật tiết kiệm pin làm lộ IP thật. Magic V2Ray chạy ở tầng hạt nhân (Kernel), chạy lặng lẽ dưới nền và không thể bị tắt.
- Tiết kiệm pin & CPU: Tự động tách biệt luồng dữ liệu. Chỉ ép các ứng dụng người dùng (game, mạng xã hội, trình duyệt) đi qua proxy, giữ nguyên các tiến trình hệ thống để máy không bị nóng và tốn pin.
- Chuyển mạng không gián đoạn: Tự động phát hiện khi bạn chuyển đổi giữa Wi-Fi và 4G/5G để cấu hình lại trong tích tắc, không bị khựng mạng 10-15 giây như app thường.
- Hỗ trợ mọi môi trường: Chạy mượt mà dù máy bạn dùng Magisk, KernelSU, hay APatch.

---

## Các tính năng chính

- **Quản lý theo danh mục (Category Organizing):** Gom nhóm các proxy server của bạn vào các thư mục hoặc danh mục tùy chỉnh.
- **Nhập liên kết thông minh (Smart Link Import):** Dễ dàng dán các URL đăng ký, các chuỗi cấu hình thô hoặc các đoạn mã văn bản hỗn hợp.
- **Cập nhật tự động với 1-Click (One-Click Auto-Reload):** Lưu lại các liên kết đăng ký để bạn có thể cập nhật toàn bộ danh mục chỉ bằng một lần chạm.
- **Không tốn pin (No Battery Drain):** Cơ chế xử lý gốc dưới nền đảm bảo thời lượng pin của bạn kéo dài hơn nhiều so với việc chạy các ứng dụng VPN độc lập nặng nề.

---

## Ghi nhận & Đóng góp

Dự án này được xây dựng dựa trên thành quả của những người đi trước. **Magic V2Ray** có sử dụng các file thực thi (binary) được biên dịch sẵn từ các dự án mã nguồn mở sau:
* **[Xray-core](https://github.com/XTLS/Xray-core):** Lõi hệ thống tối cao cho các mạng proxy thế hệ mới, xử lý các giao thức như VLESS, VMess, Trojan kết hợp với cơ chế giải mã gói tin (sniffing) linh hoạt.
* **[tun2socks](https://github.com/xjasonlyu/tun2socks):** Công cụ hiệu năng cao được sử dụng để bọc các kênh inbound SOCKS5/HTTP vào một giao diện mạng ảo TUN native của Linux.