
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
    const product = displayValue(row.A ?? row.产品 ?? row.Product, referenceNames)
    const component = displayValue(row.B ?? row.原料 ?? row.材料 ?? row.Component, referenceNames)
    const quantity = Number(row.C ?? row.数量 ?? row.Quantity)
    if (!product || !component || !Number.isFinite(quantity) || quantity <= 0) return []
    return [{ product, component, quantity }]
  })
}

export function explodeBom(rows, rootProduct, rootQuantity, referenceNames) {
  const edges = readEdges(rows, referenceNames)
  const children = new Map()
  const parents = new Map()
  edges.forEach((edge) => {
    children.set(edge.product, [...(children.get(edge.product) ?? []), edge])
    parents.set(edge.component, [...(parents.get(edge.component) ?? []), edge])
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
      children: productChildren
        .map(({ component, quantity: perUnit }) => makeTree(component, requiredQuantity * perUnit, [...path, product]))
        .filter(Boolean),
    }
    if (!productChildren.length && !seenLeaves.has(product)) {
      seenLeaves.add(product)
      leafRows.push({ key: `leaf-${product}`, item: product, quantity: totals.get(product)?.quantity ?? requiredQuantity })
    }
    return node
  }
  if (rootProduct && quantity > 0) {
    const rootNode = makeTree(rootProduct, quantity)
    tree.push(...(rootNode?.children ?? []))
  }

  const leafDependencies = leafRows.map((leaf) => {
    const root = { ...leaf, children: [] }
    const visited = new Set([leaf.item])
    function addParents(current, target) {
      ;(parents.get(current) ?? []).forEach(({ product, quantity: perUnit }) => {
        if (visited.has(product)) return
        visited.add(product)
        const parent = {
          key: `${target.key}-${product}`,
          item: product,
          quantity: perUnit,
          children: [],
        }
        target.children.push(parent)
        addParents(product, parent)
      })
    }
    addParents(leaf.item, root)
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