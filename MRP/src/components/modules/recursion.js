
function referenceKey(value) {
  if (Array.isArray(value) && value[0] === 'R') return value[2]
  return value
}

export function displayValue(value, referenceNames = new Map()) {
  const key = referenceKey(value)
  const referenceName = referenceNames.get(key)
  return referenceName ?? (key === null || key === undefined || key === '' ? '' : String(key).trim())
}

function readEdges(rows, referenceNames) {
  return rows.flatMap((row) => {
    const product = displayValue(row.A ?? row.产品 ?? row.Product ?? row.项目, referenceNames)
    const component = displayValue(row.B ?? row.原料 ?? row.材料 ?? row.Component ?? row.需求, referenceNames)
    const quantity = Number(row.C ?? row.数量 ?? row.Quantity)
    if (!product || !component || !Number.isFinite(quantity) || quantity <= 0) return []
    return [{ product, component, quantity }]
  })
}

export function explodeBom(rows, rootProduct, rootQuantity, referenceNames) {
  const edges = readEdges(rows, referenceNames)
  const children = new Map()
  edges.forEach((edge) => {
    children.set(edge.product, [...(children.get(edge.product) ?? []), edge])
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

  const quantity = Number(rootQuantity) || 0
  if (rootProduct && quantity > 0) visit(rootProduct, quantity)

  const tree = []
  const leafRows = []
  const seenLeaves = new Set()
  const treeKeys = new Set()
  function makeTree(product, requiredQuantity, path = []) {
    const key = [...path, product].join('/')
    if (treeKeys.has(key)) return null
    treeKeys.add(key)
    const productChildren = children.get(product) ?? []
    const node = {
      key,
      item: product,
      quantity: requiredQuantity,
    }
    const childRows = productChildren
      .map(({ component, quantity: perUnit }) => makeTree(component, requiredQuantity * perUnit, [...path, product]))
      .filter(Boolean)
    if (childRows.length) node.children = childRows
    if (!productChildren.length && !seenLeaves.has(product)) {
      seenLeaves.add(product)
      leafRows.push({ key: `leaf-${product}`, item: product, quantity: totals.get(product)?.quantity ?? requiredQuantity })
    }
    return node
  }
  let rootNode = null
  if (rootProduct && quantity > 0) {
    rootNode = makeTree(rootProduct, quantity)
    tree.push(...(rootNode?.children ?? []))
  }

  const leafConsumers = new Map()
  function collectLeafConsumers(node, parent = null) {
    if (!node.children) {
      if (parent && parent.item !== rootProduct) {
        const consumers = leafConsumers.get(node.item) ?? new Map()
        consumers.set(parent.item, (consumers.get(parent.item) ?? 0) + node.quantity)
        leafConsumers.set(node.item, consumers)
      }
      return
    }
    node.children.forEach((child) => collectLeafConsumers(child, node))
  }
  if (rootNode) collectLeafConsumers(rootNode)

  const leafDependencies = [...leafConsumers.entries()].map(([item, consumers]) => {
    const root = {
      key: `leaf-${item}`,
      item,
      quantity: totals.get(item)?.quantity ?? 0,
    }
    root.children = [...consumers.entries()].map(([consumer, quantity]) => ({
      key: `${root.key}-${consumer}`,
      item: consumer,
      quantity,
    }))
    return root
  })

  const requiredNodes = new Map()
  const depths = new Map()
  function collectNodes(product, requiredQuantity, depth = 0, path = []) {
    const productChildren = children.get(product)
    if (!productChildren || path.includes(product)) return
    requiredNodes.set(product, (requiredNodes.get(product) ?? 0) + requiredQuantity)
    depths.set(product, Math.max(depths.get(product) ?? 0, depth))
    productChildren.forEach(({ component, quantity: perUnit }) => {
      collectNodes(component, requiredQuantity * perUnit, depth + 1, [...path, product])
    })
  }
  if (rootProduct && quantity > 0) collectNodes(rootProduct, quantity)
  const nodeRows = [...requiredNodes.entries()]
    .sort(([left], [right]) => (depths.get(right) - depths.get(left)) || left.localeCompare(right))
    .map(([item, requiredQuantity], index) => ({
      key: `node-${item}`,
      order: index + 1,
      item,
      quantity: requiredQuantity,
    }))

  return {
    materials: [...totals.values()],
    tree,
    leafRows,
    leafDependencies,
    nodeRows,
    warnings: [...new Set(warnings)],
  }
}