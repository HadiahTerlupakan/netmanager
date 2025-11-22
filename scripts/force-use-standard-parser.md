# Force Use Standard ONU Parser (Bypass C3XX)

Jika C3XX parser tidak bekerja dengan baik (hanya dapat <50% RX data), Anda bisa force gunakan standard parser.

## Cara Force Standard Parser:

Edit file: `app/api/olts/onus/route.ts`

Cari function `isZteC3xx` dan return `false`:

```typescript
async function isZteC3xx(...): Promise<boolean> {
  // Force return false to use standard parser
  return false
  
  // Original code (comment out):
  // try {
  //   const testOid = '1.3.6.1.4.1.3902.1082'
  //   ...
  // }
}
```

Kemudian restart aplikasi dan sync lagi.

## Atau, Set Environment Variable:

Tambahkan di `.env`:

```bash
# Force use standard parser (skip C3XX detection)
FORCE_STANDARD_PARSER=true
```

Dan update code untuk check env variable ini.












