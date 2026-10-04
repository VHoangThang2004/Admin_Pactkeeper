# PactKeeper Admin Dashboard (High Counsel) ⚔️👑

> Hệ thống Quản trị & Điều hành Trung tâm (High Counsel Admin Portal) cho tựa game Chiến thuật Nhập vai **PactKeeper (Tactical SRPG)**.

---

## 📌 Tổng Quan Dự Án (Project Overview)

**PactKeeper Admin Dashboard** là cổng thông tin quản trị tối cao dành cho Game Master, Quản trị viên hệ thống (Administrator) và Bộ phận Hỗ trợ khách hàng (Customer Support). Hệ thống được thiết kế theo phong cách giao diện **Medieval RPG / Dark Fantasy** (phông chữ Cinzel, bảng Mahogany, thẻ Parchment, viền kim loại vàng hoàng gia và phù hiệu Crimson), tích hợp 100% dữ liệu thực từ backend .NET 9 qua RESTful API và SignalR Hub.

---

## 📊 Báo Cáo Tiến Trình Dự Án (Project Progress)

### Trạng Thái Tổng Thể: **Giai đoạn 1 Hoàn Tất (Phase 1 Completed - 100%)**

| Hạng mục / Module | Tiến độ | Trạng thái | Ghi chú |
| :--- | :---: | :---: | :--- |
| **Kiến trúc & Hạ tầng Frontend** | 100% | ✅ Hoàn thành | Vite 8 + React 19 + TypeScript + Tailwind CSS v4, Vercel SPA routing |
| **PactKeeper RPG Design System** | 100% | ✅ Hoàn thành | Cinzel font, Mahogany & Parchment cards, Gold borders, responsive |
| **Xác thực & Phân quyền (Auth)** | 100% | ✅ Hoàn thành | JWT Bearer, chặn quyền Player, lưu session & auto logout khi 401 |
| **Tổng quan & Điều khiển Realm** | 100% | ✅ Hoàn thành | Đo lường CCU thực, doanh thu, tổng thực thể, nút dừng khẩn cấp (Emergency Overrides) |
| **Quản lý Người chơi (Players)** | 100% | ✅ Hoàn thành | Tổng hợp người chơi đa nguồn (OAuth/Steam/Chat/PayOS), Ban/Unban, cộng trừ Vàng & Đá quý |
| **Quản lý Banner Triệu hồi (Gacha)** | 100% | ✅ Hoàn thành | Xem danh sách banner thực tế, tỷ lệ & bảo hiểm (Pity), tạo mới banner gacha |
| **Kho Lưu trữ SRPG (Game CMS)** | 100% | ✅ Hoàn thành | 6 Tabs dữ liệu gốc: Anh hùng (Heroes), Chương (Chapters/Scenes), Vũ khí, Phụ kiện, Hệ phái, Kỹ năng |
| **Sổ cái Doanh thu & PayOS Ledger** | 100% | ✅ Hoàn thành | Kết nối cổng PayOS, thống kê giao dịch PAID/PENDING/CANCELLED, quản lý gói nạp Top-Up |
| **Hỗ trợ Trực tuyến (Live Support)** | 100% | ✅ Hoàn thành | Chat Real-time qua **SignalR WebSocket**, quản lý hàng đợi người chơi cần hỗ trợ |

---

## 🚀 Tính Năng Chi Tiết (Detailed Features)

### 1. 🛡️ Cổng Đăng Nhập High Counsel (`/login`)
- Xác thực tài khoản quản trị qua API `POST /Auth/login`.
- Kiểm tra vai trò: Yêu cầu quyền `Admin` hoặc `Server`; tự động từ chối nếu là role `Player`.
- Tính năng ẩn/hiện mật khẩu, kiểm tra hợp lệ dữ liệu đầu vào (client-side validation), thông báo lỗi trực quan.

### 2. 🏰 Tổng Quan Vương Quốc (`/`)
- **Chỉ số Telemetry thời gian thực:**
  - Tổng số Tướng (Heroes/Units) trong game.
  - Tổng số Banner Gacha đang hoạt động.
  - Số lượng gói nạp (Packs) khả dụng.
  - Tổng doanh thu thực tế được tính từ các đơn hàng PayOS thành công (`PAID`).
  - Lượng người chơi đang hoạt động (Active CCU) cùng biểu đồ biến thiên Recharts.
- **Bảng điều khiển Khẩn cấp (Emergency Overrides):**
  - Chặn / Mở đăng nhập người chơi toàn server (`/admin/update-login-status`).
  - Chặn / Mở ghép trận (Matchmaking) (`/admin/update-matchmaking-status`).
  - Dừng toàn bộ hệ thống khẩn cấp (`/admin/force-stop-all`).
  - Lưu trữ trạng thái công tắc khẩn cấp qua `localStorage`.

### 3. 👥 Quản Lý Người Chơi & Kiểm Duyệt (`/players`)
- Tự động tập hợp danh sách người chơi từ nhiều nguồn: Phiên đăng nhập Google OAuth / Steam / Tài khoản thường, lịch sử thanh toán PayOS và hàng đợi chat hỗ trợ.
- Tra cứu nhanh theo `PlayerId` hoặc thêm thủ công ID người chơi vào danh sách giám sát.
- Xem chi tiết hồ sơ: Cấp độ, Điểm kinh nghiệm, Số dư Vàng (Gold), Đá quý (Gems), Thời gian đăng nhập gần nhất.
- Thao tác quản trị:
  - Khóa tài khoản (Ban) / Mở khóa tài khoản (Unban) qua `/admin/ban-player` và `/admin/unban-player`.
  - Điều chỉnh tài nguyên (Cộng/Trừ Đá quý và Vàng) trực tiếp qua `/admin/adjust-currency`.

### 4. ✨ Quản Lý Banner Triệu Hồi Gacha (`/gacha`)
- Hiển thị danh sách banner gacha đang hoạt động từ API `/gachabanner`.
- Xem chi tiết: Chi phí mỗi lượt triệu hồi, loại tiền tệ, thời hạn mở/đóng banner, danh sách Tướng và Vũ khí nổi bật (Featured Items).
- Modal tạo mới Banner Gacha (`POST /gachabanner`) với thiết lập ngày bắt đầu, ngày hết hạn và mốc bảo hiểm (Pity threshold).

### 5. 📜 Kho Dữ Liệu Cấu Hình SRPG (`/content`)
Phân tách thành 6 thẻ lưu trữ hiển thị đầy đủ thông số trò chơi từ cơ sở dữ liệu:
- **Heroes / Units (`/UnitDefinition`):** Tên Tướng, Độ hiếm (Rarity), Hệ phái (Class), Chỉ số cơ bản (HP, ATK, DEF, Speed), Kỹ năng nội tại (Passive Skill), cờ trao tặng khi đăng ký. Hỗ trợ modal tạo mới Hero.
- **Chapters & Scenes (`/ChapterConfig`):** Danh sách chương cốt truyện, mã Map, chi tiết từng phân cảnh (Scene ID, Tiêu hao Thể lực, Cấp độ khuyến nghị).
- **Weapons (`/WeaponDefinition`):** Tên vũ khí, phân loại, độ hiếm, chỉ số ATK cơ bản và các hệ số điều chỉnh thuộc tính (Stat Modifiers).
- **Trinkets (`/TrinketDefinition`):** Phụ kiện tăng cường, chỉ số HP/DEF cơ bản và bổ trợ kỹ năng.
- **Classes (`/ClassDefinition`):** Danh sách hệ phái trong game, kỹ năng di chuyển (Movement Skill) và kỹ năng đặc trưng hệ phái.
- **Skills (`/SkillDefinition`):** Thư viện kỹ năng, chi phí SP tiêu hao và mô tả hiệu ứng.

### 6. 💰 Ngân Khố & Sổ Cái Thanh Toán PayOS (`/payments`)
- Thống kê doanh thu thực tế (Tổng tiền nạp thành công, số giao dịch, tỷ lệ giao dịch hoàn tất).
- Bảng lịch sử giao dịch PayOS thời gian thực (`/payment/history`): Mã đơn hàng (`orderCode`), ID người chơi, Gói nạp, Số tiền (VND), Trạng thái đơn (`PAID`, `PENDING`, `CANCELLED`), Thời gian tạo.
- Danh mục gói nạp Kim Cương & Quà tặng (`/topuppack/all`): Bật/Tắt trạng thái mở bán gói nạp tức thì (`PATCH /topuppack/{id}/availability`).

### 7. 💬 Tổng Đài Hỗ Trợ Real-time SignalR (`/support`)
- Kết nối WebSocket trực tiếp đến `/hubs/support`.
- Danh sách người chơi gửi yêu cầu hỗ trợ theo thời gian thực (`/support/admin/players`).
- Khung chat hai chiều tức thì với người chơi: Lịch sử tin nhắn, định dạng thời gian, gửi tin nhắn phản hồi từ Admin trực tiếp tới Client game.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Phiên bản |
| :--- | :--- | :--- |
| **Core Framework** | React | `^19.2.8` |
| **Bundler & Build Tool** | Vite | `^8.2.0` |
| **Ngôn ngữ** | TypeScript | `~6.0.2` |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | `^4.3.3` |
| **Routing** | React Router DOM | `^7.18.2` |
| **HTTP Client** | Axios | `^1.19.0` |
| **Realtime WebSockets**| Microsoft SignalR Client | `^10.0.11` |
| **Biểu đồ & Phân tích** | Recharts | `^3.10.1` |
| **Icon System** | Lucide React | `^1.33.0` |
| **Linter** | Oxlint | `^1.75.0` |

---

## 📁 Cấu Trúc Thư Mục (Project Structure)

```text
Admin_Pactkeeper/
├── public/                 # Tài nguyên tĩnh
├── src/
│   ├── api/
│   │   └── adminClient.ts  # Cấu hình Axios instance & Auth Interceptors
│   ├── assets/             # Hình ảnh, logo, RPG textures
│   ├── components/
│   │   ├── Header.tsx      # Thanh điều hướng trên cùng, profile Admin
│   │   ├── Layout.tsx      # Khung layout tổng thể (Sidebar + Content + Header)
│   │   └── Sidebar.tsx     # Menu điều hướng chính mang phong cách High Counsel
│   ├── pages/
│   │   ├── ContentManagement.tsx   # CMS quản lý 6 danh mục SRPG
│   │   ├── DashboardOverview.tsx   # Tổng quan, chỉ số CCU & nút khẩn cấp
│   │   ├── GachaManagement.tsx     # Quản lý sự kiện và banner triệu hồi
│   │   ├── LiveSupport.tsx         # Chat hỗ trợ trực tuyến qua SignalR
│   │   ├── Login.tsx               # Màn hình đăng nhập quyền Admin
│   │   ├── PaymentManagement.tsx   # Quản lý đơn hàng PayOS & Gói nạp
│   │   └── PlayerManagement.tsx    # Giám sát, Ban/Unban & điều chỉnh tài nguyên
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces & DTOs
│   ├── App.css
│   ├── App.tsx             # Định tuyến Router & Quản lý trạng thái Token
│   ├── index.css           # Cấu hình Tailwind CSS & Custom RPG classes
│   └── main.tsx            # Điểm khởi chạy ứng dụng React
├── index.html
├── package.json
├── tsconfig.json
├── vercel.json             # Cấu hình điều hướng SPA khi deploy Vercel
└── vite.config.ts          # Thiết lập Proxy tới Backend Server (.NET 9)
```

---

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị Node.js LTS 20+)
- **NPM** hoặc **Yarn / PNPM**

### 2. Cài Đặt Dependencies
```bash
npm install
```

### 3. Cấu Hình Proxy Backend
Trong `vite.config.ts`, ứng dụng đã được cấu hình Proxy kết nối trực tiếp đến backend SRPG:
```typescript
proxy: {
  '/api': {
    target: 'http://srpg-backend.duckdns.org:5276',
    changeOrigin: true,
    secure: false,
  },
  '/hubs': {
    target: 'http://srpg-backend.duckdns.org:5276',
    ws: true,
    changeOrigin: true,
    secure: false,
  },
}
```

### 4. Khởi Chạy Môi Trường Phát Triển (Development)
```bash
npm run dev
```
Truy cập hệ thống tại: `http://localhost:3001`

### 5. Kiểm Tra Code & Build Production
```bash
# Kiểm tra linting
npm run lint

# Build production bundle
npm run build

# Chạy thử bản build
npm run preview
```

---

## 🗺️ Kế Hoạch Phát Triển Tiếp Theo (Roadmap - Phase 2)

- [ ] **Chỉnh sửa nâng cao SRPG Definitions:** Bổ sung tính năng Chỉnh sửa (Edit) và Xóa (Delete) trực tiếp cho Vũ khí, Trang bị, Kỹ năng và Cốt truyện trên giao diện.
- [ ] **Hệ thống Thư & Quà tặng Toàn máy chủ (Server Mail / Compensation):** Gửi thư đền bù vật phẩm, đá quý hoặc vàng hàng loạt tới toàn bộ người chơi hoặc theo danh sách chỉ định.
- [ ] **Báo cáo & Phân tích Nâng cao:** Lọc lịch sử doanh thu PayOS theo khoảng thời gian tùy chọn (ngày/tuần/tháng), biểu đồ tỷ lệ giữ chân người chơi (Retention Rate).
- [ ] **Phân quyền Đa cấp độ (Role-Based Access Control):** Tách biệt các cấp độ quản trị viên (Super Admin, Game Master, Support Agent, Data Viewer).
- [ ] **Tối ưu hóa Bundle (Code Splitting):** Áp dụng React.lazy / Suspense cho các trang quản trị để giảm dung lượng file nạp ban đầu.
- [ ] **Kiểm thử tự động:** Tích hợp bộ kiểm thử Component và E2E testing (Vitest + Playwright).
