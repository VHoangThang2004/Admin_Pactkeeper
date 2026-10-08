# PactKeeper Admin Dashboard (High Counsel) ⚔️👑

> Hệ thống Quản trị & Điều hành Trung tâm (High Counsel Admin Portal) cho tựa game Chiến thuật Nhập vai **PactKeeper (Tactical SRPG)**.

---

## 📌 Tổng Quan Dự Án (Project Overview)

**PactKeeper Admin Dashboard** là cổng thông tin quản trị tối cao dành cho Game Master, Quản trị viên hệ thống (Administrator) và Bộ phận Hỗ trợ khách hàng (Customer Support). Hệ thống được thiết kế theo phong cách giao diện **Medieval RPG / Dark Fantasy** (phông chữ Cinzel, bảng Mahogany, thẻ Parchment, viền kim loại vàng hoàng gia và phù hiệu Crimson), tích hợp 100% dữ liệu thực từ backend .NET 9 qua RESTful API và SignalR Hub.

---

## 📊 Báo Cáo Tiến Trình Dự Án (Project Progress)

### Trạng Thái Tổng Thể: **Giai đoạn 1 & Các Tính Năng Nâng Cao Hoàn Tất (100% Core Features & RBAC)**

| Hạng mục / Module | Tiến độ | Trạng thái | Ghi chú |
| :--- | :---: | :---: | :--- |
| **Kiến trúc & Hạ tầng Frontend** | 100% | ✅ Hoàn thành | Vite 8 + React 19 + TypeScript + Tailwind CSS v4, Vercel SPA routing |
| **PactKeeper RPG Design System** | 100% | ✅ Hoàn thành | Cinzel font, Mahogany & Parchment cards, Gold borders, responsive |
| **Phân quyền Đa vai trò (RBAC Auth)** | 100% | ✅ Hoàn thành | Hỗ trợ 3 vai trò High Counsel (Admin, Moderator, Support Desk) với phân quyền truy cập chặt chẽ |
| **Tổng quan Realm & Live Telemetry** | 100% | ✅ Hoàn thành | Đo lường CCU thực, theo dõi người chơi Online & Đang chiến đấu (In-Battle), nút dừng khẩn cấp |
| **Quản lý Người chơi (Players)** | 100% | ✅ Hoàn thành | Tổng hợp người chơi đa nguồn, làm sạch ID/Alias, Ban/Unban, điều chỉnh tiền tệ theo quyền hạn |
| **Quản lý Banner Triệu hồi (Gacha)** | 100% | ✅ Hoàn thành | Xem danh sách banner thực tế, tỷ lệ & bảo hiểm (Pity), tạo mới banner gacha |
| **Kho Lưu trữ SRPG (Game CMS)** | 100% | ✅ Hoàn thành | 6 Tabs dữ liệu gốc: Anh hùng (Heroes), Chương (Chapters/Scenes), Vũ khí, Phụ kiện, Hệ phái, Kỹ năng |
| **Sổ cái Doanh thu & PayOS Ledger** | 100% | ✅ Hoàn thành | Kết nối cổng PayOS, thống kê giao dịch PAID/PENDING/CANCELLED, quản lý gói nạp Top-Up |
| **Hỗ trợ Trực tuyến (Live Support)** | 100% | ✅ Hoàn thành | Chat Real-time qua **SignalR WebSocket**, đồng bộ định danh người chơi thời gian thực |
| **Quốc tế hóa & Chuẩn hóa UI (i18n)** | 100% | ✅ Hoàn thành | 100% giao diện tiếng Anh đồng nhất, chuẩn hóa định dạng tiền tệ và typography |

---

## 🚀 Tính Năng Chi Tiết (Detailed Features)

### 1. 🛡️ Cổng Đăng Nhập & Phân Quyền High Counsel (`/login`)
- Xác thực tài khoản quản trị qua API `POST /Auth/login` với JWT Bearer.
- **Bộ chọn vai trò tương tác (Interactive Role Selector):**
  - **High Counsel Admin (Full Authority):** Toàn quyền truy cập mọi tính năng, bảng điều khiển khẩn cấp, điều chỉnh kinh tế và CMS.
  - **Realm Moderator (Game Master / Arbiter):** Giám sát hồ sơ người chơi, theo dõi hiện diện và thực thi kỷ luật Khóa/Mở khóa tài khoản (Ban/Unban).
  - **Counsel Herald (Support Desk):** Vận hành tổng đài chat SignalR hai chiều với người chơi, tra cứu danh sách người chơi ở chế độ an toàn (Read-Only).
- Tự động điều hướng đến trang chuyên trách sau khi đăng nhập thành công.
- Tự động chặn và từ chối các tài khoản role `Player`.

### 2. 🏰 Tổng Quan Vương Quốc & Live Telemetry (`/`)
- **Chỉ số Telemetry & Trạng thái Thời gian thực:**
  - **Live Online & In-Battle Presence Recognition:** Nhận diện người chơi đang trực tuyến (Online) và người chơi đang trong trận chiến (In-Battle) từ backend API Match/Support.
  - Thẻ đếm số lượng trận đấu đang diễn ra và tổng số trận trong ngày.
  - Bộ lọc hiện diện người chơi tức thì: `ALL`, `ONLINE`, `BATTLE`, `OFFLINE`.
  - Tổng số Tướng (Heroes/Units), Banner Gacha và Gói nạp khả dụng.
  - Tổng doanh thu thực tế tổng hợp từ các đơn hàng PayOS thành công (`PAID`).
- **Bảng điều khiển Khẩn cấp (Emergency Overrides - Dành riêng cho Admin):**
  - Chặn / Mở đăng nhập người chơi toàn server (`/admin/update-login-status`).
  - Chặn / Mở ghép trận (Matchmaking) (`/admin/update-matchmaking-status`).
  - Dừng toàn bộ hệ thống khẩn cấp (`/admin/force-stop-all`).
  - Lưu trữ trạng thái công tắc khẩn cấp qua `localStorage`.

### 3. 👥 Quản Lý Người Chơi & Kiểm Duyệt (`/players`)
- Tự động tập hợp danh sách người chơi từ nhiều nguồn: Google OAuth, Steam, tài khoản thông thường, lịch sử PayOS và hàng đợi chat hỗ trợ.
- **Làm sạch định danh:** Chuẩn hóa các ID database/OAuth thô thành bí danh (Alias) người chơi trực quan, dễ quản lý.
- Tra cứu nhanh theo `PlayerId` hoặc thêm thủ công ID người chơi vào danh sách giám sát.
- Xem chi tiết hồ sơ: Cấp độ, Điểm kinh nghiệm, Số dư Vàng (Gold), Đá quý (Gems), Thời gian đăng nhập gần nhất.
- **Phân quyền thao tác theo Role:**
  - `Admin`: Toàn quyền Ban/Unban và điều chỉnh tiền tệ (Cộng/Trừ Gems & Gold) qua modal tương tác.
  - `Moderator`: Thực thi Ban/Unban kỷ luật người chơi.
  - `Support`: Chế độ chỉ đọc (Read-Only) an toàn, ngăn ngừa thao tác nhầm lẫn.

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
- Đồng bộ tên danh xưng người chơi thật giữa cơ sở dữ liệu và hàng đợi hỗ trợ, loại bỏ chuỗi mã hóa khó nhận diện.
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
│   │   └── Sidebar.tsx     # Menu điều hướng chính lọc quyền theo vai trò (RBAC)
│   ├── pages/
│   │   ├── ContentManagement.tsx   # CMS quản lý 6 danh mục SRPG
│   │   ├── DashboardOverview.tsx   # Tổng quan, Live Telemetry CCU/In-Battle & nút khẩn cấp
│   │   ├── GachaManagement.tsx     # Quản lý sự kiện và banner triệu hồi
│   │   ├── LiveSupport.tsx         # Chat hỗ trợ trực tuyến qua SignalR
│   │   ├── Login.tsx               # Màn hình đăng nhập hỗ trợ chọn vai trò (Admin/Mod/Support)
│   │   ├── PaymentManagement.tsx   # Quản lý đơn hàng PayOS & Gói nạp
│   │   └── PlayerManagement.tsx    # Giám sát, Ban/Unban & điều chỉnh tài nguyên theo role
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces, DTOs & CounselRole
│   ├── utils/
│   │   └── presence.ts     # Phân tích trạng thái người chơi Online & In-Battle
│   ├── App.css
│   ├── App.tsx             # Định tuyến Router & Quản lý trạng thái Token/Role
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

## 🗺️ Kế Hoạch Phát Triển Tiếp Theo (Roadmap)

### Đã hoàn thành gần đây:
- [x] **Phân quyền Đa cấp độ (Role-Based Access Control):** Tách biệt các cấp độ High Counsel (Admin / Server, Moderator, Support Desk) với thanh điều hướng lọc động và giới hạn thao tác theo quyền hạn.
- [x] **Giám sát Telemetry & Nhận diện Hiện diện (Live Presence):** Theo dõi thời gian thực người chơi Online, đang trong trận chiến (In-Battle Presence) cùng danh sách trận đấu thực tế.
- [x] **Đồng bộ Định danh & Chuẩn hóa hiển thị:** Chuyển đổi định danh thô từ DB sang bí danh dễ đọc trong giao diện Player & Hàng đợi Live Support.
- [x] **Quốc tế hóa giao diện (100% English UI Consistency):** Đồng nhất toàn bộ nhãn, nút bấm, bảng và định dạng tiền tệ sang chuẩn tiếng Anh.

### Kế hoạch tiếp theo (Upcoming Features):
- [ ] **Chỉnh sửa nâng cao SRPG Definitions:** Bổ sung tính năng Chỉnh sửa (Edit) và Xóa (Delete) trực tiếp cho Vũ khí, Trang bị, Kỹ năng và Cốt truyện trên giao diện.
- [ ] **Hệ thống Thư & Quà tặng Toàn máy chủ (Server Mail / Compensation):** Gửi thư đền bù vật phẩm, đá quý hoặc vàng hàng loạt tới toàn bộ người chơi hoặc theo danh sách chỉ định.
- [ ] **Báo cáo & Phân tích Doanh thu Nâng cao:** Lọc lịch sử doanh thu PayOS theo khoảng thời gian tùy chọn (ngày/tuần/tháng), xuất báo cáo thống kê.
- [ ] **Tối ưu hóa Bundle (Code Splitting):** Áp dụng React.lazy / Suspense cho các trang quản trị để giảm dung lượng file nạp ban đầu.
- [ ] **Kiểm thử tự động:** Tích hợp bộ kiểm thử Component và E2E testing (Vitest + Playwright).
