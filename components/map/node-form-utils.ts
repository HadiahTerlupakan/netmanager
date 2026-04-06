export const getNodeTypeLabel = (nodeType: string) => {
  switch (nodeType) {
    case 'server':
    case 'olt':
      return 'Server'
    case 'odc':
      return 'ODC'
    case 'odp':
      return 'ODP'
    case 'ont':
      return 'ONT'
    default:
      return nodeType.toUpperCase()
  }
}

export const getNodeSplitterOptions = (nodeType: string) => {
  if (nodeType === 'odc') {
    return ['1:2', '1:4', '1:8', '1:16', '1:32', '1:64']
  }

  if (nodeType === 'odp') {
    return ['1:2', '1:4', '1:8', '1:16', '1:32']
  }

  return []
}
