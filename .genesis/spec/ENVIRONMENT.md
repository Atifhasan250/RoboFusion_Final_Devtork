# Environment variables

Minimal `.env.local`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=robofusion
DEVICE_ID=rf-01
DEVICE_BASE_URL=http://192.168.4.1
NEXT_PUBLIC_DEVICE_CAMERA_URL=http://192.168.4.1/api/v1/camera
```

Notes:
- `DEVICE_BASE_URL` changes when ESP32 joins the real WiFi; update it or make device discovery configurable.
- Do not commit real WiFi password or Mongo cloud credentials.
- If MongoDB is unavailable during early work, tests should use mocked repository/service interfaces, then switch to real Mongo before demo.
