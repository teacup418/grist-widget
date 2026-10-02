import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { connectToGrist, isGristWidget } from './grist'

const demoBomRows = [
  { 产品: '产品 B', 材料: '模块 A', 数量: 2 },
  { 产品: '产品 B', 材料: '螺丝', 数量: 4 },
  { 产品: '模块 A', 材料: '铝板', 数量: 1 },
  { 产品: '模块 A', 材料: '螺丝', 数量: 2 },
]

function referenceKey(value) {
  if (Array.isArray(value) && value[0] === 'R') return value[2]
  return value
}

function displayValue(value, referenceNames = new Map()) {
  const key = referenceKey(value)
  const referenceName = referenceNames.get(key)
  return referenceName ?? (key === null || key === undefined || key === '' ? '' : String(key).trim())
}

function explodeBom(rows, rootProduct, rootQuantity, referenceNames) {
  const children = new Map()
  rows.forEach((row) => {
    const product = displayValue(row.A ?? row.产品 ?? row.Product, referenceNames)
    const component = displayValue(row.B ?? row.原料 ?? row.材料 ?? row.Component, referenceNames)
    if (product === null || product === undefined || component === null || component === undefined) return
    const productChildren = children.get(product) ?? []
    productChildren.push({
      component,
      quantity: Number(row.C ?? row.数量 ?? row.Quantity) || 0,
    })
    children.set(product, productChildren)
  })

  const totals = new Map()
  const warnings = []
  const visiting = new Set()
  function visit(product, multiplier, path = []) {
    if (visiting.has(product)) {
      warnings.push(`检测到循环引用：${[...path, product].join(' -> ')}`)
      return
    }
    const productChildren = children.get(product)
    if (!productChildren) {
      const current = totals.get(product) ?? { name: product, quantity: 0 }
      totals.set(product, { ...current, quantity: current.quantity + multiplier })
      return
    }
    visiting.add(product)
    productChildren.forEach(({ component, quantity }) => {
      visit(component, multiplier * quantity, [...path, product])
    })
    visiting.delete(product)
  }
  visit(rootProduct, rootQuantity)
  return { materials: [...totals.values()], warnings: [...new Set(warnings)] }
}

function App() {
  const [bomRows, setBomRows] = useState(() => (isGristWidget() ? [] : demoBomRows))
  const [selectedProduct, setSelectedProduct] = useState(() => (isGristWidget() ? '' : '产品 B'))
  const [planQuantity, setPlanQuantity] = useState(() => (isGristWidget() ? 0 : 1))
  const [referenceNames, setReferenceNames] = useState(new Map())
  const [error, setError] = useState('')

  useEffect(() => connectToGrist({
    onBomRows: (nextRows, nextReferenceNames) => {
      setBomRows(nextRows)
      setReferenceNames(nextReferenceNames)
      setError('')
    },
    onRecord: (record) => {
      const product = String(record?.Product ?? '').trim()
      if (product) setSelectedProduct(product)
      setPlanQuantity(Number(record?.PlanQuantity) || 0)
    },
    onError: () => setError('无法读取产品 BOM 表，请检查表的内部 ID 和完整文档访问权限。'),
  }), [])

  const result = useMemo(() => explodeBom(bomRows, selectedProduct, planQuantity, referenceNames), [bomRows, selectedProduct, planQuantity, referenceNames])

  return (
    <main className="bom-app">
      <header className="app-header">
        <div><p className="eyebrow">PRODUCT STRUCTURE / BOM</p><h1>最终物料清单</h1><p className="subtitle">从多级产品结构展开到采购级原材料。</p></div>
        <span className={`connection ${isGristWidget() ? 'connected' : ''}`}><span className="connection-dot" />{isGristWidget() ? 'GRIST 已连接' : '本地演示数据'}</span>
      </header>
      <section className="control-bar" aria-label="生产计划">
        <span>当前生产计划</span>
        <strong>{selectedProduct || '请选择生产计划中的一行'}</strong>
        <span className="row-count">生产数量：{planQuantity} · BOM 关系：{bomRows.length} 条</span>
      </section>
      {error && <p className="notice error">{error}</p>}
      {result.warnings.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}
      <section className="result-panel">
        <div className="panel-heading"><div><p className="eyebrow">EXPLODED RESULT</p><h2>{selectedProduct || '尚未选择产品'}</h2></div><div className="material-total"><strong>{result.materials.length}</strong><span>种最终物料</span></div></div>
        {result.materials.length ? <div className="material-table" role="table" aria-label="最终物料清单">
          <div className="table-row table-head" role="row"><span>最终物料</span><span>最终需求数量</span></div>
          {result.materials.map((material) => <div className="table-row" role="row" key={material.name}><span>{material.name}</span><strong>{material.quantity}</strong></div>)}
        </div> : <div className="empty-state">请在 Grist 中选择数据表，并完成三列映射。</div>}
      </section>
      <footer className="schema-note">生产计划：需求 × 数量 · 产品 BOM：产品 → 材料 × 数量</footer>
    </main>
  )
}

export default App
