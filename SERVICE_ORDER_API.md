# Jasa Titip API Documentation

## Overview
Fitur Jasa Titip memungkinkan customer untuk mencari driver aktif dan melakukan transaksi langsung tanpa melalui toko. Driver dapat menerima request jasa titip dan berkomunikasi langsung dengan customer melalui WhatsApp.

## Flow Jasa Titip

### Customer Flow:
1. **Mencari Driver Aktif**: Customer mencari driver yang tersedia di sekitar lokasi pickup
2. **Halaman Jasa Titip**: Sistem menampilkan informasi driver, biaya pengiriman, dan tombol chat WhatsApp
3. **Chat WhatsApp**: Customer menghubungi driver melalui WhatsApp untuk deal
4. **Order Accepted**: Setelah deal, driver menerima order melalui aplikasi

### Driver Flow:
1. **Menerima Request**: Driver menerima request jasa titip dari customer
2. **Deal Jasa Titip**: Driver dan customer bernegosiasi melalui WhatsApp
3. **Accept Order**: Driver menerima order melalui aplikasi
4. **Order Accepted**: Status order berubah menjadi "driver_found"

## Pricing Structure

Biaya pengiriman jasa titip berdasarkan tujuan:
- **Balige**: Rp 30.000
- **Laguboti**: Rp 15.000
- **Lainnya**: Rp 20.000 (default)

## API Endpoints

### 1. Get Available Drivers for Jasa Titip
**GET** `/api/v1/service-orders/available-drivers`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `pickup_latitude` (required): Latitude lokasi pickup
- `pickup_longitude` (required): Longitude lokasi pickup  
- `destination_address` (required): Alamat tujuan

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan driver yang tersedia",
  "data": {
    "service_fee": 30000,
    "destination_address": "Balige, Toba Samosir",
    "available_drivers": [
      {
        "id": 1,
        "name": "John Driver",
        "phone": "081234567890",
        "distance_km": 2.5,
        "estimated_arrival": 5,
        "whatsapp_link": "https://wa.me/6281234567890",
        "service_fee": 30000,
        "destination_address": "Balige, Toba Samosir"
      }
    ]
  }
}
```

**Response Error (404):**
```json
{
  "status": "error",
  "message": "Tidak ada driver yang tersedia saat ini"
}
```

### 2. Accept Jasa Titip Order (Driver)
**POST** `/api/v1/service-orders/accept`

**Headers:**
```
Authorization: Bearer <driver_token>
```

**Request Body:**
```json
{
  "customer_id": 1,
  "pickup_address": "Jl. Sudirman No. 123",
  "pickup_latitude": -2.5,
  "pickup_longitude": 99.0,
  "destination_address": "Balige, Toba Samosir",
  "destination_latitude": -2.3,
  "destination_longitude": 99.1,
  "description": "Beli oleh-oleh khas Balige",
  "customer_phone": "081234567890"
}
```

**Response Success (201):**
```json
{
  "status": "success",
  "message": "Jasa titip berhasil diterima",
  "data": {
    "id": 1,
    "customer_id": 1,
    "driver_id": 1,
    "service_type": "delivery",
    "pickup_address": "Jl. Sudirman No. 123",
    "pickup_latitude": -2.5,
    "pickup_longitude": 99.0,
    "destination_address": "Balige, Toba Samosir",
    "destination_latitude": -2.3,
    "destination_longitude": 99.1,
    "description": "Beli oleh-oleh khas Balige",
    "service_fee": 30000,
    "customer_phone": "081234567890",
    "driver_phone": "081234567891",
    "estimated_duration": 25,
    "status": "driver_found",
    "distance_km": 15.2,
    "estimated_duration_text": "25 menit",
    "customer_whatsapp_link": "https://wa.me/6281234567890?text=..."
  }
}
```

### 3. Create Jasa Titip Order (Customer)
**POST** `/api/v1/service-orders/`

**Headers:**
```
Authorization: Bearer <customer_token>
```

**Request Body:**
```json
{
  "service_type": "delivery",
  "pickup_address": "Jl. Sudirman No. 123",
  "pickup_latitude": -2.5,
  "pickup_longitude": 99.0,
  "destination_address": "Balige, Toba Samosir",
  "destination_latitude": -2.3,
  "destination_longitude": 99.1,
  "description": "Beli oleh-oleh khas Balige",
  "customer_phone": "081234567890"
}
```

**Response Success (201):**
```json
{
  "status": "success",
  "message": "Jasa titip berhasil dibuat. Mencari driver terdekat...",
  "data": {
    "id": 1,
    "customer_id": 1,
    "service_type": "delivery",
    "pickup_address": "Jl. Sudirman No. 123",
    "pickup_latitude": -2.5,
    "pickup_longitude": 99.0,
    "destination_address": "Balige, Toba Samosir",
    "destination_latitude": -2.3,
    "destination_longitude": 99.1,
    "description": "Beli oleh-oleh khas Balige",
    "service_fee": 30000,
    "customer_phone": "081234567890",
    "estimated_duration": 25,
    "status": "pending",
    "distance_km": 15.2,
    "estimated_duration_text": "25 menit"
  }
}
```

### 4. Get Customer Jasa Titip Orders
**GET** `/api/v1/service-orders/customer`

**Headers:**
```
Authorization: Bearer <customer_token>
```

**Query Parameters:**
- `page` (optional): Halaman (default: 1)
- `limit` (optional): Jumlah per halaman (default: 10)
- `status` (optional): Filter status

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan data service orders",
  "data": {
    "totalItems": 5,
    "totalPages": 1,
    "currentPage": 1,
    "serviceOrders": [
      {
        "id": 1,
        "customer_id": 1,
        "driver_id": 1,
        "service_type": "delivery",
        "pickup_address": "Jl. Sudirman No. 123",
        "destination_address": "Balige, Toba Samosir",
        "service_fee": 30000,
        "status": "completed",
        "created_at": "2024-01-01T10:00:00Z",
        "driver": {
          "id": 1,
          "user": {
            "id": 2,
            "name": "John Driver",
            "phone": "081234567891"
          }
        }
      }
    ]
  }
}
```

### 5. Get Driver Jasa Titip Orders
**GET** `/api/v1/service-orders/driver`

**Headers:**
```
Authorization: Bearer <driver_token>
```

**Query Parameters:**
- `page` (optional): Halaman (default: 1)
- `limit` (optional): Jumlah per halaman (default: 10)
- `status` (optional): Filter status

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan data service orders",
  "data": {
    "totalItems": 3,
    "totalPages": 1,
    "currentPage": 1,
    "serviceOrders": [
      {
        "id": 1,
        "customer_id": 1,
        "driver_id": 1,
        "service_type": "delivery",
        "pickup_address": "Jl. Sudirman No. 123",
        "destination_address": "Balige, Toba Samosir",
        "service_fee": 30000,
        "status": "in_progress",
        "created_at": "2024-01-01T10:00:00Z",
        "customer": {
          "id": 1,
          "name": "Jane Customer",
          "phone": "081234567890"
        }
      }
    ]
  }
}
```

### 6. Update Jasa Titip Order Status
**PUT** `/api/v1/service-orders/:id/status`

**Headers:**
```
Authorization: Bearer <driver_token>
```

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Sedang menuju lokasi pickup"
}
```

**Response Success (200):**
```json
{
  "status": "success",
      "message": "Status jasa titip berhasil diupdate",
  "data": {
    "id": 1,
    "status": "in_progress",
    "notes": "Sedang menuju lokasi pickup",
    "actual_start_time": "2024-01-01T10:30:00Z"
  }
}
```

### 7. Get Jasa Titip Order by ID
**GET** `/api/v1/service-orders/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan data service order",
  "data": {
    "id": 1,
    "customer_id": 1,
    "driver_id": 1,
    "service_type": "delivery",
    "pickup_address": "Jl. Sudirman No. 123",
    "pickup_latitude": -2.5,
    "pickup_longitude": 99.0,
    "destination_address": "Balige, Toba Samosir",
    "destination_latitude": -2.3,
    "destination_longitude": 99.1,
    "description": "Beli oleh-oleh khas Balige",
    "service_fee": 30000,
    "status": "completed",
    "customer_phone": "081234567890",
    "driver_phone": "081234567891",
    "estimated_duration": 25,
    "actual_start_time": "2024-01-01T10:30:00Z",
    "actual_completion_time": "2024-01-01T11:00:00Z",
    "created_at": "2024-01-01T10:00:00Z",
    "customer": {
      "id": 1,
      "name": "Jane Customer",
      "phone": "081234567890"
    },
    "driver": {
      "id": 1,
      "user": {
        "id": 2,
        "name": "John Driver",
        "phone": "081234567891"
      }
    },
    "review": {
      "id": 1,
      "rating": 5,
      "comment": "Driver sangat baik dan cepat"
    }
  }
}
```

### 8. Cancel Jasa Titip Order
**POST** `/api/v1/service-orders/:id/cancel`

**Headers:**
```
Authorization: Bearer <customer_token>
```

**Request Body:**
```json
{
  "reason": "Tidak jadi pergi ke Balige"
}
```

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Service order berhasil dibatalkan",
  "data": {
    "id": 1,
    "status": "cancelled",
    "notes": "Tidak jadi pergi ke Balige"
  }
}
```

### 9. Create Jasa Titip Review
**POST** `/api/v1/service-orders/:id/review`

**Headers:**
```
Authorization: Bearer <customer_token>
```

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Driver sangat baik dan cepat. Jastip sesuai permintaan!"
}
```

**Response Success (201):**
```json
{
  "status": "success",
  "message": "Review berhasil dibuat",
  "data": {
    "service_order_id": 1,
    "driver_review": {
      "rating": 5,
      "comment": "Driver sangat baik dan cepat. Jasa titip sesuai permintaan!"
    },
    "driver_rating": 4.8
  }
}
```

## Status Jasa Titip Order

1. **pending**: Order baru dibuat, mencari driver
2. **driver_found**: Driver ditemukan dan order diterima
3. **in_progress**: Driver sedang mengerjakan jasa titip
4. **completed**: Jasa titip selesai
5. **cancelled**: Order dibatalkan

## WhatsApp Integration

Sistem akan generate link WhatsApp otomatis dengan template pesan:

**Customer ke Driver:**
```
Halo [Driver Name], saya [Customer Name] dari aplikasi DelPick.

Saya membutuhkan jasa titip dengan detail:
📍 Lokasi Pickup: [Pickup Address]
📍 Lokasi Tujuan: [Destination Address]
💰 Biaya Pengiriman: Rp [Service Fee]
📝 Notes: [Description]

Apakah Anda bisa menangani jastip ini? Terima kasih!
```

**Driver ke Customer:**
```
Halo [Customer Name], saya driver dari DelPick.

Saya telah menerima pesanan jasa titip Anda:
📍 Pickup: [Pickup Address]
📍 Tujuan: [Destination Address]
💰 Biaya Pengiriman: Rp [Service Fee]

Saya akan segera menuju lokasi pickup. Terima kasih!
```

## Error Codes

- **400**: Bad Request - Invalid input
- **401**: Unauthorized - Token tidak valid
- **403**: Forbidden - Tidak memiliki akses
- **404**: Not Found - Resource tidak ditemukan
- **500**: Internal Server Error - Kesalahan server

## Notes

- Semua endpoint memerlukan authentication token
- Coordinate menggunakan format decimal degrees
- Phone number harus format Indonesia (10-13 digit)
- Jasa titip fee ditentukan berdasarkan destination address
- Driver harus dalam status 'active' untuk menerima order
- Customer dapat membatalkan order hanya jika status 'pending' atau 'driver_found'
- Review hanya dapat dibuat setelah order selesai ('completed') 