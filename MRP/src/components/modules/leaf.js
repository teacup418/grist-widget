export const leafColumns = [
  { title: '叶子材料 / 依赖节点', dataIndex: 'item', key: 'item' },
  { title: '依赖数量', dataIndex: 'quantity', key: 'quantity' },
]

export function createLeafTableData(leafDependencies) {
  return leafDependencies
}