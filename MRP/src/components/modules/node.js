export const nodeColumns = [
  { title: '生产顺序', dataIndex: 'order', key: 'order', width: 100 },
  { title: '树枝节点', dataIndex: 'item', key: 'item' },
  { title: '需求数量', dataIndex: 'quantity', key: 'quantity' },
]

export function createNodeTableData(nodeRows) {
  return nodeRows
}