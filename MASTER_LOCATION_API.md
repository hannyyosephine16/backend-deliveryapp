# Master Location API Documentation

## Overview
Sistem Master Location menyediakan database lokasi standar untuk daerah Toba dengan harga tetap per region. Destinasi semua jasa titip adalah **IT Del** dengan tarif yang sudah ditentukan berdasarkan lokasi pickup.

## Fitur Utama

### 1. Database Lokasi Daerah Toba
- 5 lokasi populer di sekitar Danau Toba
- Harga tetap per region ke IT Del
- Estimasi waktu tempuh yang sudah ditentukan

### 2. Sistem Harga Tetap
- **Sitoluama**: Rp 10,000 (terdekat, 15 menit)
- **Laguboti**: Rp 15,000 (25 menit)  
- **Parapat**: Rp 20,000 (30 menit)
- **Balige**: Rp 25,000 (45 menit)
- **Samosir**: Rp 30,000 (60 menit, via ferry)

### 3. Destinasi Tetap
- Semua jasa titip berakhir di **IT Del**
- Tidak ada perhitungan jarak dinamis
- Harga sudah final berdasarkan pickup location

## API Endpoints

### 1. Get All Locations
**GET** `/api/v1/locations`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Halaman (default: 1)
- `limit` (optional): Jumlah per halaman (default: 10)

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan data lokasi",
  "data": {
    "totalItems": 5,
    "totalPages": 1,
    "currentPage": 1,
    "locations": [
      {
        "id": 1,
        "name": "Balige",
        "latitude": "2.33340000",
        "longitude": "99.06670000",
        "service_fee": "25000.00",
        "estimated_duration_minutes": 45,
        "is_active": true
      }
    ]
  }
}
```

### 2. Get Popular Locations
**GET** `/api/v1/locations/popular`

**Headers:**
```
Authorization: Bearer <token>
```

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan lokasi populer",
  "data": {
    "locations": [
      {
        "id": 1,
        "name": "Balige",
        "service_fee": "25000.00",
        "estimated_duration_minutes": 45,
        "is_active": true
      }
    ]
  }
}
```

### 3. Search Locations
**GET** `/api/v1/locations/search`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (required): Query pencarian (minimal 2 karakter)

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mencari lokasi",
  "data": {
    "locations": [
      {
        "id": 1,
        "name": "Balige",
        "service_fee": "25000.00",
        "estimated_duration_minutes": 45
      }
    ]
  }
}
```

### 4. Get Service Fee
**GET** `/api/v1/locations/service-fee`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `pickup_location_id` (required): ID lokasi pickup

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan biaya layanan",
  "data": {
    "pickup_location": {
      "id": 3,
      "name": "Parapat"
    },
    "destination": "IT Del",
    "service_fee": 20000,
    "estimated_duration": 30,
    "estimated_duration_text": "30 menit"
  }
}
```

### 5. Get Location by ID
**GET** `/api/v1/locations/{id}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response Success (200):**
```json
{
  "status": "success",
  "message": "Berhasil mendapatkan detail lokasi",
  "data": {
    "location": {
      "id": 1,
      "name": "Balige",
      "latitude": "2.33340000",
      "longitude": "99.06670000",
      "service_fee": "25000.00",
      "estimated_duration_minutes": 45,
      "is_active": true
    }
  }
}
```

## Integrasi dengan Service Orders

### Enhanced Service Order Creation
Service order sekarang dapat menggunakan master location untuk menentukan biaya secara otomatis:

```javascript
// Contoh penggunaan di frontend
const createServiceOrder = async (orderData) => {
  // 1. Dapatkan biaya berdasarkan pickup location
  const feeResponse = await fetch('/api/v1/locations/service-fee?pickup_location_id=3');
  const feeData = await feeResponse.json();
  
  // 2. Buat service order dengan biaya yang sudah ditentukan
  const serviceOrder = {
    pickup_address: 'Parapat',
    pickup_latitude: 2.6667,
    pickup_longitude: 98.9333,
    description: 'Titip barang ke IT Del',
    customer_phone: '081234567890',
    // service_fee akan dihitung otomatis berdasarkan pickup_address
  };
  
  const response = await fetch('/api/v1/service-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serviceOrder)
  });
};
```

## Database Schema

### master_locations table
```sql
CREATE TABLE master_locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    service_fee DECIMAL(10,2) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Data Lokasi
```sql
INSERT INTO master_locations (name, latitude, longitude, service_fee, estimated_duration_minutes) VALUES
('Sitoluama', 2.3500, 99.1500, 10000, 15),
('Laguboti', 2.5167, 99.2833, 15000, 25),
('Parapat', 2.6667, 98.9333, 20000, 30),
('Balige', 2.3334, 99.0667, 25000, 45),
('Samosir', 2.5833, 98.8333, 30000, 60);
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Query pencarian minimal 2 karakter"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Lokasi tidak ditemukan"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Terjadi kesalahan saat mengambil data lokasi",
  "errors": "Database connection failed"
}
```

## Usage Examples

### 1. Frontend Integration
```javascript
// Get all locations for dropdown
const locations = await fetch('/api/v1/locations').then(r => r.json());

// Search locations
const searchResults = await fetch('/api/v1/locations/search?q=Balige').then(r => r.json());

// Get service fee
const fee = await fetch('/api/v1/locations/service-fee?pickup_location_id=1').then(r => r.json());
```

### 2. Mobile App Integration
```dart
// Flutter example
Future<List<Location>> getLocations() async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/v1/locations'),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['data']['locations'].map<Location>((json) => Location.fromJson(json)).toList();
  }
  throw Exception('Failed to load locations');
}
```

## Best Practices

1. **Cache Locations**: Cache lokasi di client untuk mengurangi request
2. **Search Optimization**: Gunakan debouncing untuk search input
3. **Error Handling**: Selalu handle error response dengan graceful fallback
4. **Offline Support**: Simpan lokasi populer untuk akses offline

## Changelog

### v1.0.0 (Current)
- Sistem harga tetap per region
- 5 lokasi daerah Toba
- Destinasi tetap ke IT Del
- Integrasi dengan service orders
- Pencarian lokasi berdasarkan nama 