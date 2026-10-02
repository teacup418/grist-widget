export const BOM_TABLE_ID = 'BOM'
export const REFERENCE_TABLE_ID = 'IC_DATA'

export const columnSchema = [
  { name: 'Product', title: '需求产品', type: 'Ref', description: '生产计划中本次要生产的产品' },
  { name: 'PlanQuantity', title: '生产数量', type: 'Numeric', description: '本次生产的产品数量' },
]

export function isGristWidget() {
  return window.parent !== window && typeof window.grist !== 'undefined'
}

function rowsFromTable(table) {
  if (Array.isArray(table)) return table
  const columnNames = Object.keys(table ?? {})
  const rowCount = Math.max(0, ...columnNames.map((name) => table[name]?.length ?? 0))
  return Array.from({ length: rowCount }, (_, index) => {
    return Object.fromEntries(columnNames.map((name) => [name, table[name][index]]))
  })
}

export function connectToGrist({ onBomRows, onRecord, onError }) {
  if (!isGristWidget()) return () => {}

  try {
    window.grist.ready({ requiredAccess: 'full', columns: columnSchema, allowSelectBy: true })
    Promise.all([
      window.grist.docApi.fetchTable(BOM_TABLE_ID),
      window.grist.docApi.fetchTable(REFERENCE_TABLE_ID),
    ])
      .then(([bomTable, referenceTable]) => {
        const referenceRows = rowsFromTable(referenceTable)
        const referenceNames = new Map(referenceRows.map((row) => {
          const fallback = Object.entries(row).find(([key, value]) => {
            return key !== 'id' && typeof value === 'string' && value.trim()
          })?.[1]
          const name = row.名称 ?? row.Name ?? row.name ?? row.产品 ?? row.材料 ?? fallback
          return [row.id, name]
        }))
        onBomRows(rowsFromTable(bomTable), referenceNames)
      })
      .catch(onError)
    window.grist.onRecord((record) => {
      onRecord(window.grist.mapColumnNames(record) ?? record)
    })
  } catch (error) {
    onError(error)
  }

  return () => {}
}