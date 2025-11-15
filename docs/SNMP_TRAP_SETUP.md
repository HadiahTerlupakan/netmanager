# Setup SNMP TRAP untuk Monitoring Real-Time ONU

## 📚 **Apa itu SNMP TRAP?**

**SNMP TRAP** adalah mekanisme event-driven dimana **OLT mengirim notifikasi** ke aplikasi monitoring saat ada event penting (ONU down, temperature alert, dll).

### **Perbedaan dengan Polling:**

| Aspek | SNMP Polling | SNMP TRAP |
|-------|-------------|-----------|
| **Cara Kerja** | Aplikasi query OLT setiap X menit | OLT kirim notifikasi saat ada event |
| **Real-time** | ❌ Delay 5-30 menit | ✅ Instant (<1 detik) |
| **Efisiensi** | ❌ Query terus-menerus | ✅ Hanya saat ada event |
| **Beban OLT** | ❌ Tinggi (polling terus) | ✅ Rendah |
| **Data** | ✅ Data lengkap | ⚠️ Hanya event info |

### **Best Practice: KOMBINASI**
- **SNMP TRAP**: Real-time alerts (ONU down/up)
- **SNMP Polling**: Periodic sync (detail info, Basic Info fields)

---

## 🚀 **Cara Mengaktifkan SNMP TRAP**

### **Step 1: Konfigurasi Environment Variable**

Edit file `.env`:

```bash
# SNMP Trap Configuration
SNMP_TRAP_ENABLED=true

# Port untuk SNMP Trap (default 162)
# Gunakan 1162 jika tidak running as root
SNMP_TRAP_PORT=1162
```

### **Step 2: Restart Aplikasi**

```bash
# Stop aplikasi (Ctrl+C)
# Lalu start lagi
npm run dev
```

Aplikasi akan menampilkan log:
```
[Scheduler] SNMP Trap Receiver started on port 1162
[SNMP-TRAP] Listening for ONU events from OLTs...
```

### **Step 3: Konfigurasi OLT untuk Kirim TRAP**

Login ke OLT via Telnet/SSH dan jalankan command:

```bash
# Login ke OLT
telnet 113.192.1.98

# Masuk ke config mode
enable
config

# Set SNMP trap destination ke IP server NetManager
snmp-agent target-host trap-hostname NetManager address <IP_SERVER> udp-port 1162

# Set trap community (default: public)
snmp-agent community read public
snmp-agent community write public

# Enable SNMP trap
snmp-agent trap enable

# Enable ONU-specific traps
snmp-agent trap enable feature-name gpon
snmp-agent trap enable onu

# Save config
write

# Exit
exit
```

**Ganti `<IP_SERVER>`** dengan IP server tempat NetManager running!

---

## ⚙️ **Konfigurasi OLT ZTE (Detail)**

### **A. Via CLI (Telnet/SSH)**

```bash
# 1. Set trap destination
snmp-agent target-host trap-hostname NetManager address udp-domain 192.168.1.100 udp-port 1162

# 2. Set SNMP community
snmp-agent community read public
snmp-agent community write public

# 3. Enable SNMP agent
snmp-agent

# 4. Enable traps
snmp-agent trap enable
snmp-agent trap enable feature-name gpon
snmp-agent trap enable feature-name equipment
snmp-agent trap enable feature-name onu

# 5. Set trap untuk specific events
snmp-agent trap enable onu-linkup
snmp-agent trap enable onu-linkdown
snmp-agent trap enable onu-dying-gasp
snmp-agent trap enable temperature-threshold

# 6. Save
write
```

### **B. Via Web UI** (jika tersedia)

1. Login ke Web UI OLT
2. Pergi ke: **System** → **SNMP** → **Trap Configuration**
3. Add new trap target:
   - **Target IP**: IP server NetManager
   - **Port**: 1162
   - **Community**: public
   - **Version**: v2c
4. Enable traps:
   - ☑️ ONU Link Up/Down
   - ☑️ ONU Dying Gasp
   - ☑️ Temperature Alert
   - ☑️ Power Loss
5. **Save & Apply**

---

## 🧪 **Testing SNMP TRAP**

### **Test 1: Manual Trigger dari OLT**

```bash
# Login ke OLT
telnet 113.192.1.98

# Send test trap
snmp-agent trap send test

# Atau trigger real event (misalnya disable/enable ONU)
interface gpon-onu_1/1/3:1
shutdown
no shutdown
```

### **Test 2: Check Log di NetManager**

Di terminal aplikasi Next.js, Anda akan melihat:

```
[SNMP-TRAP] Received trap from 113.192.1.98:161
[SNMP-TRAP] Parsed trap: {
  sourceIp: '113.192.1.98',
  eventType: 'onu_los',
  onu: { ponId: 268632320, onuId: 1 }
}
[SNMP-TRAP] ONU LOS detected from 113.192.1.98
```

### **Test 3: Verify dengan tcpdump** (optional)

```bash
# Monitor port 1162
sudo tcpdump -i any -n port 1162

# Anda akan lihat packet dari OLT saat ada event
```

---

## 📊 **Events yang Didukung**

| Event | Deskripsi | OID | Action |
|-------|-----------|-----|--------|
| **ONU Online** | ONU berhasil connect | `...28.2.1.4 = 3` | Update status, clear alert |
| **ONU LOS** | Loss of Signal | `...28.2.1.4 = 1` | Update status, kirim alert |
| **ONU Offline** | ONU mati/disconnect | `...28.2.1.4 = 6` | Update status, kirim alert |
| **Dying Gasp** | Power loss pada ONU | `...50.12.1.1.21` | Urgent alert! |
| **Temperature Alert** | Suhu terlalu tinggi | `...50.12.1.1.19` | Warning alert |
| **Auth Failed** | Registrasi gagal | `...28.1.1.12` | Security alert |

---

## 🛠️ **Troubleshooting**

### **Problem 1: Tidak Ada Trap yang Diterima**

**Cek:**
1. ✅ OLT sudah dikonfigurasi dengan IP server yang benar?
2. ✅ Port 1162 tidak di-block firewall?
3. ✅ Aplikasi NetManager sudah running?
4. ✅ `SNMP_TRAP_ENABLED=true` di .env?

**Test:**
```bash
# Check apakah port 1162 listening
sudo netstat -tuln | grep 1162

# Check firewall (macOS)
sudo pfctl -s rules | grep 1162

# Test send trap manual dari OLT
snmp-agent trap send test
```

### **Problem 2: Permission Denied (Port 162)**

**Solusi:**

Port 162 (default SNMP trap port) butuh root privileges.

**Option A: Gunakan port 1162** (Recommended)
```bash
# Di .env
SNMP_TRAP_PORT=1162

# Di OLT config
snmp-agent target-host trap-hostname NetManager address <IP> udp-port 1162
```

**Option B: Run as root** (Not recommended)
```bash
sudo npm run dev
```

**Option C: Port forwarding** (macOS/Linux)
```bash
# Forward port 162 → 1162
sudo socat UDP-LISTEN:162,fork UDP:localhost:1162 &
```

### **Problem 3: Trap Received tapi Tidak Di-process**

**Check log:**
```bash
# Cek detail trap di log
[SNMP-TRAP] Parsed trap: null  ← Masalah parsing!
```

**Debug:**
- Check OID format apakah sesuai dengan ZTE OLT
- Verify SNMP community string
- Check trap version (v1/v2c/v3)

---

## 🎯 **Recommended Setup**

### **Production Setup:**

1. **Enable SNMP TRAP** untuk real-time monitoring:
   ```bash
   SNMP_TRAP_ENABLED=true
   SNMP_TRAP_PORT=1162
   ```

2. **Reduce polling frequency** (karena sudah ada trap):
   ```bash
   # Dari 30 menit → 2 jam (untuk backup sync)
   ONU_SYNC_CRON="0 */2 * * *"
   ```

3. **Benefits:**
   - ⚡ Real-time alerts (<1 detik)
   - 💪 Mengurangi beban OLT (polling lebih jarang)
   - 📊 Data tetap lengkap (polling untuk detail info)
   - ✅ Best of both worlds!

---

## 📈 **Monitoring & Alerting**

### **Future Enhancements** (TODO):

1. **Database Logging**:
   - Simpan semua trap events ke database
   - History/audit trail untuk troubleshooting

2. **Alert Notifications**:
   - Email alert untuk Dying Gasp
   - Telegram/WhatsApp notification
   - Dashboard untuk monitor real-time events

3. **Dashboard Real-time**:
   - WebSocket push ke frontend
   - Live status ONU tanpa refresh
   - Event timeline/graph

---

## 📝 **Summary**

**Current Implementation:**
- ✅ SNMP Trap Receiver service created
- ✅ Auto-start dengan aplikasi
- ✅ Basic event parsing untuk ZTE OLT
- ✅ Logging semua events

**Setup Required:**
1. Set `SNMP_TRAP_ENABLED=true` di .env
2. Konfigurasi OLT untuk kirim trap ke server
3. Restart aplikasi
4. Test dengan trigger event di OLT

**Next Steps:**
- Integrate dengan database (update ONU status real-time)
- Implement alert system (email/telegram)
- Add WebSocket untuk push ke frontend
- Create event history page

---

## 🔗 **Resources**

- [ZTE OLT SNMP MIB Documentation](../docs/ZTE_OLT_MIB_IMPLEMENTATION.md)
- [SNMP TRAP OIDs](../docs/ZTE_VLAN_SNMP_OIDS.md)
- [Net-SNMP Documentation](http://www.net-snmp.org/docs/man/snmptrapd.html)

---

**Pertanyaan?** Cek log aplikasi atau tanyakan! 🚀

