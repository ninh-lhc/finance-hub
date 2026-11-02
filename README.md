# Finance Hub

Ứng dụng quản lý tài chính cá nhân (React + Vite + Firebase).

## Yêu cầu môi trường

- **Node.js** 20 trở lên (khuyến nghị cho Vite 7 và Vitest 5)
- **npm** (đi kèm Node.js)

## Chạy local

Cài dependency:

```bash
npm install
```

Tạo file cấu hình local từ mẫu:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**

```bash
cp .env.example .env.local
```

Điền **Firebase web config** (từ Firebase Console → Project settings → Your apps) vào `.env.local`. Xem danh sách biến ở mục [Biến môi trường](#biến-môi-trường) bên dưới.

Chạy dev server:

```bash
npm run dev
```

## Kiểm tra dự án

```bash
npm run test
npm run lint
npm run build
npm run check
```

`npm run check` chạy lần lượt lint, test và build.

## Biến môi trường

| Biến | Mô tả |
|------|--------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

- **`.env.local`**: chỉ dùng trên máy local, **không commit** (đã nằm trong `.gitignore`).
- **`.env.example`**: chỉ liệt kê tên biến, không chứa giá trị thật — dùng làm mẫu khi setup hoặc cấu hình hosting.

Firebase web config không phải server private key; bảo vệ dữ liệu vẫn phụ thuộc Authentication, Firestore Security Rules và cấu hình domain được phép.

## Triển khai Vercel (cấu hình, chưa deploy trong repo)

1. Import repository GitHub vào [Vercel](https://vercel.com).
2. **Framework preset:** Vite.
3. **Build command:** `npm run build`
4. **Output directory:** `dist`
5. Trong **Project Settings → Environment Variables**, thêm toàn bộ biến `VITE_FIREBASE_*` (cùng tên như `.env.example`) cho môi trường Production (và Preview nếu cần).
6. **Redeploy** sau khi thêm hoặc sửa biến môi trường.
7. Sau khi có domain Vercel (ví dụ `*.vercel.app`), thêm domain đó vào Firebase Console → **Authentication** → **Settings** → **Authorized domains**, để đăng nhập/Auth hoạt động trên bản deploy.

Không cần `vercel.json` cho SPA hiện tại nếu không dùng client-side routing cần rewrite.

## Firestore Security Rules

File rules mục tiêu: [`firestore.rules`](firestore.rules). Cấu hình emulator: [`firebase.json`](firebase.json) (Firestore emulator port **8080**).

**Cảnh báo:** Đây là **target rules** và **CHƯA được deploy** lên production. Deploy ngay sẽ **vô hiệu hóa legacy public sync** (`artifacts/.../public/data/sync_*`). Cần **migration dữ liệu** khỏi public sync trước khi deploy production. Production **chưa** được bảo vệ bởi rules mới cho đến khi deploy có chủ đích.

Rules mục tiêu:

- Chỉ user đã đăng nhập (`request.auth != null`) mới truy cập dữ liệu UID.
- Mỗi user chỉ đọc/ghi dưới `artifacts/tai-chinh-cua-toi/users/{ownUid}/...` (anonymous authenticated UID được coi như owner của chính UID đó).
- Cross-user và sai namespace app bị từ chối.
- Legacy public sync path bị **deny** (read/write).

### Chạy rules tests

Firestore Emulator cần **Java**. Môi trường dev đã được kiểm chứng với **Eclipse Temurin JDK 21** (OpenJDK 21 LTS). Rules tests dùng project emulator giả `demo-finance-hub-rules-test` (không phải production project).

```bash
npm run test:rules
```

Chạy lint + unit tests + build + rules tests:

```bash
npm run check:all
```

`npm run test` vẫn chỉ chạy Vitest (không khởi động emulator).

## Chẩn đoán nguồn dữ liệu

Trước khi lên kế hoạch migration khỏi legacy public sync, có thể so sánh trạng thái **chỉ đọc** trên từng thiết bị (không ghi Firestore, không đọc thêm query chẩn đoán):

1. Mở **Cài đặt** → tab **Đồng bộ**.
2. Xem panel **Chẩn đoán dữ liệu và đồng bộ**: kiểu đăng nhập, nguồn dữ liệu (UID vs phòng cũ), UID/mã đồng bộ **đã che**, kỳ đang quan sát và các count của phiên hiện tại.
3. **Không** gửi full UID hoặc full mã đồng bộ cho người khác — chỉ so sánh dạng đã che (ví dụ laptop vs điện thoại).
4. So sánh laptop và điện thoại: masked UID giống hay khác, cùng chế độ legacy sync hay không, count tháng hiện tại có tương đồng không.
5. Trong lúc chẩn đoán, **không** bấm tạo phòng, tham gia phòng, ngắt kết nối, hay liên kết/đăng nhập Google.
6. Security Rules mục tiêu trong repo **vẫn chưa deploy** — deploy sớm sẽ chặn legacy public sync.

Masked UID giống nhau **không** đủ để chứng minh toàn bộ lịch sử giống nhau; đây chỉ là tín hiệu chẩn đoán trên dữ liệu đang tải.

### Deploy tham khảo (không chạy trong repo)

Sau khi migration legacy sync xong, deploy rules/indexes **chỉ khi đã review**:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project tai-chinh-cua-toi
```

Không có `.firebaserc` trong repo; lệnh trên chỉ mang tính tham khảo.
