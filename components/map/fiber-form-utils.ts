export type FiberFormState = {
  name: string
  fiberType: string
  notes: string
}

export const buildFiberFormInitialState = ({
  sourceName,
  targetName,
  fiberType,
}: {
  sourceName: string
  targetName: string
  fiberType: string
}): FiberFormState => ({
  name: `${sourceName} → ${targetName}`,
  fiberType: fiberType || 'distribution',
  notes: '',
})

export const getFiberTypeInfo = (type: string) => {
  switch (type) {
    case 'feeder':
      return { color: 'text-purple-500', label: 'Purple line - Feeder network' }
    case 'distribution':
      return { color: 'text-blue-500', label: 'Blue line - Distribution network' }
    case 'drop':
      return { color: 'text-green-500', label: 'Green line - Drop network' }
    default:
      return { color: 'text-gray-500', label: 'Gray line - Standard connection' }
  }
}
