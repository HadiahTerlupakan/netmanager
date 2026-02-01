import MixRadiusClient from '../MixRadiusClient'

export default function MixRadiusIsolirPage() {
  return <MixRadiusClient defaultStatus="Isolir" viewMode="isolir" />
}

export const metadata = {
  title: 'MixRadius Isolir',
  description: 'Daftar pelanggan isolir/suspend',
}
