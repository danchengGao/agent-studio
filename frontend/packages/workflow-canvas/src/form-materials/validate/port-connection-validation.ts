export const checkPortConnection = (node: any, portId: string, portType: 'input' | 'output' = 'output'): boolean => {
  if (!node) return false

  try {
    if (node.lines?.[portType + 'Lines']) {
      const lines = node.lines[portType + 'Lines']
      const hasConnection = lines.some((line: any) => {
        return portType === 'output' ? line.fromPortId === portId : line.toPortId === portId
      })

      if (hasConnection) return true
    }

    if (node.lines?.availableLines) {
      const hasAvailableLine = node.lines.availableLines.some((line: any) => {
        return portType === 'output' ? line.fromPortId === portId : line.toPortId === portId
      })

      if (hasAvailableLine) return true
    }

    if (node.ports?.[portType + 'Ports']) {
      const ports = node.ports[portType + 'Ports']
      const targetPort = ports.find((port: any) => port.portID === portId || port.id === portId)

      if (targetPort) {
        return !!(targetPort.availableLines && targetPort.availableLines.length > 0)
      }
    }

    return false
  } catch (error) {
    return false
  }
}
