# Backup Strategy untuk NetManager

## 📋 Overview

Dokumen ini menjelaskan strategi backup dan recovery untuk database NetManager.

---

## 🔄 Backup Strategy

### **Automated Daily Backup**

Backup otomatis dilakukan setiap hari pada jam 02:00 AM menggunakan cron job.

### **Manual Backup**

Backup manual dapat dilakukan kapan saja menggunakan script yang disediakan.

---

## 📦 Backup Scripts

### **1. Backup Script**

**File:** `scripts/backup-db.sh`

**Usage:**
```bash
# Backup ke default location (./backups)
./scripts/backup-db.sh

# Backup ke custom location
./scripts/backup-db.sh /path/to/backup/directory
```

**Fitur:**
- ✅ Backup database PostgreSQL
- ✅ Kompresi otomatis (gzip)
- ✅ Nama file dengan timestamp
- ✅ Auto-cleanup (menyimpan 30 backup terakhir)
- ✅ Error handling

**Output:**
- File: `netmanager_backup_YYYYMMDD_HHMMSS.sql.gz`
- Location: `./backups/` (default) atau custom location

---

### **2. Restore Script**

**File:** `scripts/restore-db.sh`

**Usage:**
```bash
./scripts/restore-db.sh ./backups/netmanager_backup_20240101_120000.sql.gz
```

**Fitur:**
- ✅ Restore dari backup file
- ✅ Auto-drop database lama (dengan konfirmasi)
- ✅ Support compressed backup (.sql.gz)
- ✅ Error handling

**⚠️ Warning:** Restore akan menghapus database yang ada dan menggantinya dengan data dari backup!

---

## ⚙️ Setup Automated Backup

### **1. Setup Cron Job (Linux/macOS)**

Edit crontab:
```bash
crontab -e
```

Tambahkan baris berikut untuk backup harian jam 02:00 AM:
```cron
0 2 * * * cd /path/to/netmanager && ./scripts/backup-db.sh >> /var/log/netmanager-backup.log 2>&1
```

### **2. Setup dengan systemd timer (Linux)**

Buat file `/etc/systemd/system/netmanager-backup.service`:
```ini
[Unit]
Description=NetManager Database Backup
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/netmanager
ExecStart=/path/to/netmanager/scripts/backup-db.sh
```

Buat file `/etc/systemd/system/netmanager-backup.timer`:
```ini
[Unit]
Description=NetManager Database Backup Timer
Requires=netmanager-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Aktifkan timer:
```bash
sudo systemctl enable netmanager-backup.timer
sudo systemctl start netmanager-backup.timer
```

---

## 📁 Backup Storage

### **Local Storage**

Backup disimpan di direktori `./backups/` (default).

**Retention Policy:**
- Menyimpan 30 backup terakhir
- Backup lama otomatis dihapus
- Dapat diubah di script `backup-db.sh`

### **Remote Storage (Recommended untuk Production)**

Untuk production, backup sebaiknya disimpan di remote storage:

1. **Cloud Storage (S3, Google Cloud Storage, dll)**
   ```bash
   # Upload backup ke S3 setelah backup
   aws s3 cp ./backups/netmanager_backup_*.sql.gz s3://your-bucket/backups/
   ```

2. **FTP/SFTP Server**
   ```bash
   # Upload backup ke FTP server
   scp ./backups/netmanager_backup_*.sql.gz user@server:/backups/
   ```

3. **Network Attached Storage (NAS)**
   ```bash
   # Copy backup ke NAS
   cp ./backups/netmanager_backup_*.sql.gz /mnt/nas/backups/
   ```

---

## 🔄 Recovery Procedure

### **1. Restore dari Local Backup**

```bash
# List available backups
ls -lh ./backups/

# Restore dari backup
./scripts/restore-db.sh ./backups/netmanager_backup_20240101_120000.sql.gz
```

### **2. Restore dari Remote Backup**

```bash
# Download backup dari remote storage
aws s3 cp s3://your-bucket/backups/netmanager_backup_20240101_120000.sql.gz ./

# Restore
./scripts/restore-db.sh ./netmanager_backup_20240101_120000.sql.gz
```

### **3. Point-in-Time Recovery**

Untuk point-in-time recovery, gunakan PostgreSQL WAL (Write-Ahead Logging):

1. Setup PostgreSQL dengan WAL archiving
2. Gunakan `pg_basebackup` untuk base backup
3. Gunakan WAL files untuk recovery ke waktu tertentu

**Note:** Point-in-time recovery memerlukan konfigurasi PostgreSQL yang lebih kompleks.

---

## ✅ Backup Verification

### **1. Verify Backup File**

```bash
# Check backup file exists and is not corrupted
ls -lh ./backups/netmanager_backup_*.sql.gz

# Test decompress
gunzip -t ./backups/netmanager_backup_20240101_120000.sql.gz
```

### **2. Test Restore (Recommended)**

Secara berkala, test restore backup ke database test:

```bash
# Restore ke test database
POSTGRES_DB=netmanager_test ./scripts/restore-db.sh ./backups/netmanager_backup_20240101_120000.sql.gz

# Verify data
psql -U netmgr -d netmanager_test -c "SELECT COUNT(*) FROM \"User\";"
```

---

## 📊 Backup Monitoring

### **1. Check Backup Status**

```bash
# Check last backup
ls -lt ./backups/ | head -5

# Check backup size
du -sh ./backups/
```

### **2. Monitor Backup Logs**

```bash
# View backup logs
tail -f /var/log/netmanager-backup.log
```

### **3. Alert on Backup Failure**

Setup monitoring untuk alert jika backup gagal:

```bash
# Check if backup exists for today
if [ ! -f "./backups/netmanager_backup_$(date +%Y%m%d)_*.sql.gz" ]; then
  echo "ALERT: Backup failed for $(date +%Y%m%d)"
  # Send alert (email, Slack, dll)
fi
```

---

## 🔐 Security Best Practices

1. **Encrypt Backups**
   ```bash
   # Encrypt backup sebelum upload
   gpg --encrypt --recipient backup@example.com netmanager_backup_*.sql.gz
   ```

2. **Secure Backup Storage**
   - Gunakan encrypted storage
   - Limit access ke backup files
   - Rotate backup encryption keys

3. **Backup Access Control**
   - Limit siapa yang bisa akses backup
   - Audit backup access logs
   - Use strong passwords untuk backup storage

---

## 📝 Checklist

### **Daily**
- [ ] Verify backup berhasil (check logs)
- [ ] Check backup file size (tidak terlalu kecil)
- [ ] Verify backup file tidak corrupted

### **Weekly**
- [ ] Test restore ke test database
- [ ] Verify backup retention policy
- [ ] Check backup storage space

### **Monthly**
- [ ] Review backup strategy
- [ ] Test disaster recovery procedure
- [ ] Update backup documentation

---

## 🆘 Disaster Recovery

### **Scenario 1: Database Corruption**

1. Stop aplikasi
2. Restore dari backup terbaru
3. Verify data integrity
4. Restart aplikasi

### **Scenario 2: Accidental Data Deletion**

1. Identifikasi waktu sebelum deletion
2. Restore dari backup sebelum deletion
3. Export data yang perlu
4. Restore ke production dengan data yang benar

### **Scenario 3: Server Failure**

1. Setup server baru
2. Install PostgreSQL
3. Restore dari backup terbaru
4. Restore aplikasi
5. Verify semua berfungsi

---

## 📚 Referensi

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore Documentation](https://www.postgresql.org/docs/current/app-pgrestore.html)

---

**Terakhir diupdate:** $(date)

