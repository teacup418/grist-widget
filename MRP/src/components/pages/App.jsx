import { useEffect, useMemo, useState } from 'react'
import { Table } from 'antd'
import './App.css'
import { connectToGrist, isGristWidget } from '../modules/grist'
import { explodeBom } from '../modules/recursion'
import { treeColumns, createTreeTableData } from '../modules/tree'
import { leafColumns, createLeafTableData } from '../modules/leaf'
import { nodeColumns, createNodeTableData } from '../modules/node'

const demoBomRows = [
  { 产品: '桌子', 材料: '厚木板', 数量: 1 },
  { 产品: '厚木板', 材料: '木头', 数量: 2 },
  { 产品: '桌子', 材料: '钉子', 数量: 1 },
  { 产品: '钉子', 材料: '金属', 数量: 2 },
  { 产品: '桌子', 材料: '锤子', 数量: 1 },
  { 产品: '锤子', 材料: '金属', 数量: 1 },
  { 产品: '锤子', 材料: '木头', 数量: 1 },
]

function App() {
  const [bomRows, setBomRows] = useState(() => (isGristWidget() ? [] : demoBomRows))
  const [selectedProduct, setSelectedProduct] = useState(() => (isGristWidget() ? '' : '桌子'))
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

  const result = useMemo(
    () => explodeBom(bomRows, selectedProduct, planQuantity, referenceNames),
    [bomRows, selectedProduct, planQuantity, referenceNames],
  )

  return (
    <main className="bom-app">
      <header className="app-header">
        <div>
          <p className="eyebrow">MRP / BOM</p>
          <h1>生产物料计划</h1>
          <p className="subtitle">从当前选中的产品生成完整的生产依赖顺序。</p>
        </div>
        <span className={`connection ${isGristWidget() ? 'connected' : ''}`}>
          <i className="connection-dot" />{isGristWidget() ? 'GRIST 已连接' : '演示数据'}
        </span>
      </header>

      {error && <p className="notice error">{error}</p>}
      {result.warnings.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}

      <section className="plan-card">
        <p className="eyebrow">当前选择</p>
        <div className="plan-values">
          <div><span>生产产品</span><strong>{selectedProduct || '未选择'}</strong></div>
          <div><span>生产数量</span><strong>{planQuantity || 0}</strong></div>
        </div>
      </section>

      <Section title="BOM 拆解树" description="从当前产品的第一层原料展开到最底层材料。">
        <Table columns={treeColumns} dataSource={createTreeTableData(result.tree)} defaultExpandAllRows pagination={false} />
      </Section>
      <Section title="树叶依赖" description="每种叶子材料被哪些树枝节点直接或间接依赖。">
        <Table columns={leafColumns} dataSource={createLeafTableData(result.leafDependencies)} defaultExpandAllRows pagination={false} />
      </Section>
      <Section title="树枝生产顺序" description="按依赖关系从叶子向根节点排列，先生产依赖项。">
        <Table
          columns={nodeColumns}
          dataSource={createNodeTableData(result.nodeRows)}
          pagination={false}
        />
      </Section>
    </main>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="result-panel">
      <div className="panel-heading">
        <div><h2>{title}</h2><p className="panel-description">{description}</p></div>
      </div>
      {children}
    </section>
  )
}

export default App
