# ZTE C300-B SNMP OIDs (dari Template Zabbix)

Dokumentasi ini berisi OID SNMP yang digunakan untuk monitoring OLT ZTE C300-B, diambil dari template Zabbix.

## 📊 System Information

### Temperature
- **OID**: `1.3.6.1.4.1.3902.1015.2.1.3.2.0`
- **Type**: INTEGER
- **Unit**: Celsius (°C)
- **Description**: Temperatur OLT

### Uptime
- **OID**: `1.3.6.1.2.1.1.3.0`
- **Type**: TimeTicks (centiseconds)
- **Unit**: uptime
- **Description**: System uptime
- **Preprocessing**: Multiply by 0.01 to convert to seconds

## 🔧 Hardware Monitoring

### Fan Rotation Speed
- **Discovery OID**: `1.3.6.1.4.1.3902.1015.2.1.3.10.10.10.1.7`
- **Item OID**: `1.3.6.1.4.1.3902.1015.2.1.3.10.10.10.1.7.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: rpm
- **Description**: Rotasi kipas (fan) per index

### Board Status
- **Discovery OID**: `1.3.6.1.4.1.3902.1015.2.1.3.13.5.1.1`
- **Status OID**: `1.3.6.1.4.1.3902.1015.2.1.1.3.1.5.{#SNMPINDEX}`
- **Type**: INTEGER
- **Values**: 
  - `1` = UP/Service
  - `4` = OFFLINE
- **Description**: Status papan/board

### Board CPU Usage
- **OID**: `1.3.6.1.4.1.3902.1015.2.1.1.3.1.9.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: %
- **Description**: Penggunaan CPU per board

### Board Memory Usage
- **OID**: `1.3.6.1.4.1.3902.1015.2.1.1.3.1.11.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: %
- **Description**: Penggunaan memori per board

### Board Temperature
- **OID**: `1.3.6.1.4.1.3902.1015.2.1.3.13.5.1.1.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: Celsius (°C)
- **Description**: Temperatur per board

## 📡 GPON/ONU Monitoring

### Signal Attenuation (Atenuação)
- **Discovery OID**: `1.3.6.1.4.1.3902.1082.30.40.2.4.1.3`
- **Item OID**: `1.3.6.1.4.1.3902.1082.30.40.2.4.1.3.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: dBm
- **Preprocessing**: Multiply by 0.001
- **Description**: Sinyal atenuasi per interface GPON

### Authorized ONUs per Port
- **Discovery OID**: `1.3.6.1.2.1.31.1.1.1.1` (filter: GPON ports)`
- **Item OID**: `1.3.6.1.4.1.3902.1082.500.10.2.2.3.1.14.{#SNMPINDEX}`
- **Type**: INTEGER
- **Description**: Jumlah ONU yang diotorisasi per port GPON

### Online ONUs per Port
- **Discovery OID**: `1.3.6.1.2.1.31.1.1.1.1` (filter: GPON ports)`
- **Item OID**: `1.3.6.1.4.1.3902.1082.500.10.2.2.3.1.15.{#SNMPINDEX}`
- **Type**: INTEGER
- **Description**: Jumlah ONU yang online per port GPON

## 💻 CPU & Memory Monitoring (C3XX Base 1082)

### CPU Usage per Card
- **Discovery OID**: `1.3.6.1.4.1.3902.1082.10.1.2.4.1.9.1.1`
- **Item OID**: `1.3.6.1.4.1.3902.1082.10.1.2.4.1.9.1.1.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: %
- **Description**: Penggunaan CPU per card

### Memory Usage per Card
- **Discovery OID**: `1.3.6.1.4.1.3902.1082.10.1.2.4.1.11.1.1`
- **Item OID**: `1.3.6.1.4.1.3902.1082.10.1.2.4.1.11.1.1.{#SNMPINDEX}`
- **Type**: INTEGER
- **Unit**: %
- **Description**: Penggunaan memori per card

## 🔌 Interface Monitoring

### Interface Status
- **Discovery OID**: `1.3.6.1.2.1.31.1.1.1.1` (all interfaces)
- **Status OID**: `1.3.6.1.2.1.2.2.1.8.{#SNMPINDEX}`
- **Type**: INTEGER
- **Values**:
  - `1` = Up
  - `2` = Down
- **Description**: Status interface (GPON, Ethernet, dll)

### Interface Traffic (64-bit counters)
- **In Octets**: `1.3.6.1.2.1.31.1.1.1.6.{#SNMPINDEX}`
- **Out Octets**: `1.3.6.1.2.1.31.1.1.1.10.{#SNMPINDEX}`
- **Type**: Counter64
- **Unit**: bps (bits per second)
- **Preprocessing**: 
  1. Change per second
  2. Multiply by 8 (to convert bytes to bits)
- **Description**: Traffic masuk dan keluar per interface

## 📝 Catatan Penting

1. **Base OID untuk ZTE C300-B**: `1.3.6.1.4.1.3902.1015` (hardware monitoring)
2. **Base OID untuk ZTE C3XX**: `1.3.6.1.4.1.3902.1082` (GPON/ONU monitoring)
3. **Discovery Rules**: Banyak OID menggunakan discovery rules dengan `{#SNMPINDEX}` sebagai placeholder
4. **Preprocessing**: Beberapa nilai memerlukan preprocessing (multiplier, change per second)
5. **Value Maps**: Beberapa OID menggunakan value maps untuk konversi nilai (misal: 1 = UP, 2 = Down)

## 🚀 Implementasi di Aplikasi

OID ini bisa digunakan untuk:
- Monitoring kesehatan OLT (temperature, CPU, memory)
- Monitoring status hardware (fan, board)
- Monitoring GPON ports dan ONU
- Monitoring traffic interface
- Alerting untuk threshold tertentu

