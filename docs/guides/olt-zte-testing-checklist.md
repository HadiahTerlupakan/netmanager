# OLT ZTE C300/C320 — Testing Checklist

> Validasi modul OLT terhadap device ZTE asli (C300 / C320). Lakukan
> di **lab atau staging OLT**, bukan production OLT yang melayani
> pelanggan. Setiap test harus diverifikasi dengan **eyeball** ke
> output asli, bukan sekedar "tidak ada error".

## Pra-syarat

- [ ] Akses telnet ke OLT (port 23 default)
- [ ] User & password telnet (& enable password jika ada)
- [ ] Akses SNMP read-only (community string)
- [ ] Setidaknya 1 ONU yang **belum ter-bind** (untuk register test)
- [ ] Pengetahuan posisi card: `slot frame` & `slot` real device kamu
- [ ] (Opsional) Bandwidth profile sudah pre-defined di OLT untuk test bandwidth

```
# Pre-define bandwidth profile (jika belum ada)
ZXAN(config)# pon-onu-bandwidth-profile name BW_10M upbw 1024 downbw 10240
```

---

## 1. SNMP Discovery

```bash
snmpwalk -v2c -c <community> <olt-ip> 1.3.6.1.4.1.3902.1082.500.10.2.2.5.1
```

- [ ] Output **tidak kosong** → unregistered ONU table OID benar
- [ ] Format index: `.<frame>.<slot>.<port>.<onuIndex>` (4 angka di akhir)
- [ ] Value SN ONU bisa dibaca (`HEX:...` atau ASCII)

Kalau kosong / error: ganti branch OID di `modules/olt/config/oid-registry/zte.oid.ts`
sesuai output `snmpwalk 1.3.6.1.4.1.3902.1082`.

```bash
snmpwalk -v2c -c <community> <olt-ip> 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
```

- [ ] Output mencakup ONU yang sudah teregistrasi
- [ ] Status value: `1` = online, `2` = offline, `3` = los

---

## 2. Tambah OLT Device via UI

URL: `/admin/olt/devices/tambah`

- [ ] Vendor `ZTE` terpilih default
- [ ] HSGQ/Hioso/CData ditandai "Coming soon" dan disabled
- [ ] Field telnet: port, user, pass, enable pass, default slot frame, default slot
- [ ] Submit → device tersimpan, redirect ke list

---

## 3. Test Connection

`/admin/olt/devices/<id>` → klik "Test Connection"

- [ ] Response `connected: true`
- [ ] `OltCommandLog` ada entry `TEST_CONNECTION` dengan `result: SUCCESS`
- [ ] Logger output: `[ZteAdapter] SNMP OK: <sysDescr>` + `[ZteAdapter] Telnet OK`

---

## 4. SNMP Walk Explorer

`/admin/olt/devices/<id>/snmp-explorer` → masukkan OID `1.3.6.1.2.1.1`

- [ ] Hasil ada `sysDescr`, `sysObjectID`, `sysUpTime`, `sysContact`, `sysName`
- [ ] Fitur input OID strict: hanya angka & titik (mis. coba `; rm -rf /` → ditolak validator)

---

## 5. Discovery Unregistered ONU

`/admin/olt/devices/<id>/scan` (POST) atau klik "Scan ONU" di UI

- [ ] Response `found: <N>` dengan N > 0 (asumsi ada ONU unregistered)
- [ ] Cek tabel `onu_devices`: ada record `status: UNREGISTERED` dengan `onuIndex: NULL`
- [ ] `lastSeen` ter-update saat scan ulang
- [ ] Tidak ada unique constraint violation di log

---

## 6. Register ONU (Critical Path)

`/admin/olt/onu/<id>/register` (POST) atau via UI "Register ONU".

Test case A: minimal (no VLAN, no bandwidth)

```json
{
  "oltId": "<id>",
  "serialNumber": "ZTEGXXXXXXXX",
  "ponPort": 1,
  "onuIndex": 5
}
```

- [ ] Response `success: true`
- [ ] Cek `OltCommandLog`: command `REGISTER_ONU`, result `SUCCESS`
- [ ] Eyeball ke OLT: `show running-config interface gpon-onu_<F>/<S>/<P>:<O>`
  → ada konfigurasi minimal `onu N type default sn ZTEGXXXXXXXX`

Test case B: dengan VLAN + bandwidth profile

```json
{
  "oltId": "<id>",
  "serialNumber": "ZTEGYYYYYYYY",
  "ponPort": 1,
  "onuIndex": 6,
  "vlanId": 100,
  "bandwidthProfile": "BW_10M"
}
```

- [ ] Response `success: true`
- [ ] Eyeball ke OLT:
  - `show running-config pon-onu-mng gpon-onu_F/S/P:6` →
    ada `tcont 1 profile BW_10M`, `gemport 1 tcont 1`, `service HSI gemport 1 vlan 100`
  - `show running-config interface gpon-olt_F/S/P` →
    ada `service-port 1 vport gpon-onu_F/S/P:6.1 user-vlan 100 vlan 100`

Kalau B fail tapi A success → provisioning best-effort jalan, ONU bind tapi
trafik belum bisa lewat. Cek log: `[ZteAdapter] ONU ... bound tapi
provisioning gagal: ...` dan setting manual via "Set VLAN".

---

## 7. Set VLAN Manual (kalau provisioning best-effort gagal)

Belum ada UI eksplisit untuk set VLAN ONU; gunakan bulk API atau
`OnuControlService.setOnuVlan` di service. Test via API client.

---

## 8. Disable / Enable ONU

`/admin/olt/onu/<id>/disable` (POST) → `/admin/olt/onu/<id>/enable` (POST)

- [ ] Disable: response `disabled: true`, ONU di OLT show status `disabled`
- [ ] Status DB → `DISABLED`
- [ ] Enable: ONU kembali `online`, status DB → `ACTIVE`

---

## 9. Reboot ONU

`/admin/olt/onu/<id>/reboot` (POST)

- [ ] Response `rebooted: true`
- [ ] Eyeball: ONU di OLT lampu mati lalu menyala lagi (~30 detik)
- [ ] `OltCommandLog` ada entry `REBOOT_ONU`

---

## 10. Optical Power & Power History

`/admin/olt/onu/<id>/optical` (GET)

- [ ] Response `rxPower` & `txPower` dalam dBm (mis. -20.5)
- [ ] Nilai realistis (ONU normal RX: -22 to -28 dBm)

`/admin/olt/onu/<id>/power-history?hours=24` (GET)

- [ ] Returns array power data (kalau cron monitoring sudah jalan)

---

## 11. Cron Monitoring

```bash
curl -X POST http://<host>/api/cron/olt-monitoring \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] Response 200 dengan timestamp + per-tenant stats
- [ ] Cek table `onu_power_history`: ada record baru
- [ ] Cek `olt_alerts`: kalau ada ONU dengan RX < -25 dBm → ada alert
- [ ] Run kedua kalinya dalam 5 menit → **tidak ada duplicate alert** (dedup window 6 jam)

```bash
# Auth invalid → 401
curl -X POST http://<host>/api/cron/olt-monitoring \
  -H "Authorization: Bearer wrong"
```

- [ ] Response 401 unauthorized

---

## 12. Cron Discovery

```bash
curl -X POST http://<host>/api/cron/olt-discovery \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] Response 200, semua tenant ter-iterate
- [ ] ONU yang baru terpasang otomatis muncul di tabel `onu_devices`
  status `UNREGISTERED`

---

## 13. Pre-registration → Auto-register

1. Pre-register SN belum ada secara manual:
   ```
   POST /api/olt/onu/pre-register
   { "serialNumber": "ZTEGZZZZZZZZ", "oltId": "<id>", "vlanId": 100 }
   ```
2. Pasang ONU fisik di OLT
3. Jalankan cron discovery / scan manual
4. - [ ] ONU otomatis ter-register (status: REGISTERED)
   - [ ] Pre-registration row → status `COMPLETED`, `completedAt` ter-set
   - [ ] Kalau pre-reg ada `pelangganId` → otomatis ter-assign

---

## 14. Lifecycle Pelanggan → ONU Sync

1. Bind ONU ke pelanggan (assign API)
2. Suspend pelanggan via UI pelanggan
3. - [ ] ONU otomatis disabled di OLT (cek log handler `[OltEvent]`)
   - [ ] Status DB ONU → `DISABLED`
4. Activate pelanggan
5. - [ ] ONU otomatis enabled
   - [ ] Status DB ONU → `ACTIVE`

---

## 15. Multi-tenancy (Security)

Buat tenant kedua, login user tenant B, coba akses `oltId` milik tenant A:

- [ ] `GET /api/olt/devices/<oltId-tenant-A>` → 404
- [ ] `PATCH /api/olt/devices/<oltId-tenant-A>` → 404
- [ ] `DELETE /api/olt/onu/<onuId-tenant-A>` → 404
- [ ] `POST /api/olt/devices/<oltId-tenant-A>/scan` → 404
- [ ] Test fishing dengan SN milik tenant lain di pre-register → 200 (boleh,
  beda tenant pakai SN sama itu OK secara model)

---

## 16. Bulk Operations

`POST /api/olt/onu/bulk/disable` dengan 50 onuIds

- [ ] Response: `total: 50, success: <N>, failed: <50-N>`
- [ ] Operasi per item teraudit di `OltCommandLog`
- [ ] Tidak ada timeout kumulatif (50 telnet sequential ~25-50 detik)

---

## 17. Failed Telnet Output Detection

Coba register ONU dengan SN yang sudah ter-bind di OLT (manual via CLI):

- [ ] Response `success: false, error: "Command rejected: ..."`
- [ ] Status DB tidak ter-update jadi REGISTERED
- [ ] `OltCommandLog` ada entry `REGISTER_ONU` dengan result `FAILED`

---

## Catatan Implementation

### Yang Dianggap Best-Effort (boleh gagal)

- T-CONT / GEM port / service-port provisioning saat register (logged sebagai
  warn, ONU tetap ter-bind)
- Cleanup service-port saat deregister (kalau service-port tidak ada,
  command `no service-port` akan no-op)

### Yang Mandatory (harus success)

- Bind ONU (`onu N type default sn X`)
- Unbind ONU (`no onu N`) saat deregister
- Disable / Enable ONU (`shutdown` / `no shutdown`)
- Reboot ONU (`reboot` di pon-onu-mng)

### Kalau Discover Tidak Detect ONU

1. Verifikasi `unregisteredOnuTable` OID dengan `snmpwalk`
2. Cek ZTE config: `show pon onu uncfg` di CLI — ONU yang sudah di-discover
   secara otomatis muncul di table SNMP
3. Beberapa firmware butuh `onu auto-discovery enable` di pon-port level

### Kalau Register Bind Sukses tapi ONU Tetap "ranging-state"

- ONU mungkin butuh konfigurasi service yang spesifik vendor ONU (HUAWEI,
  ZTE, Fiberhome) — adapter saat ini pakai `type default`. Untuk vendor
  spesifik, command jadi `onu N type ZTE-F660 sn ...`.
- Pastikan jarak fiber < 20km dan splitter ratio cocok.

---

## Reporting Issues

Kalau ada test yang gagal, lampirkan:
1. Output `show running-config` dari OLT setelah test
2. Log dari aplikasi (`[ZteAdapter]`, `[Provisioning]`, `[OnuControl]`)
3. Output `snmpwalk` untuk OID yang dicurigai
4. Model OLT, firmware version (`show version`), card version

Update OID registry / command sequence di adapter berdasarkan hasil
verifikasi lapangan.
