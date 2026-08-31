/** Extract the contents of a CSS block using balanced-brace matching. */
export function extractCssBlock(source: string, marker: string): string {
  let markerIndex = -1
  let searchFrom = 0
  while (searchFrom < source.length) {
    const candidate = source.indexOf(marker, searchFrom)
    if (candidate < 0) break
    const before = candidate === 0 ? "" : source[candidate - 1]
    const after = source[candidate + marker.length] ?? ""
    if ((candidate === 0 || /\s|[{}]/.test(before)) && (after === "" || /\s|\{/.test(after))) {
      markerIndex = candidate
      break
    }
    searchFrom = candidate + marker.length
  }
  if (markerIndex < 0) {
    throw new Error(`CSS block marker not found: ${marker}`)
  }

  const openingBrace = source.indexOf("{", markerIndex + marker.length)
  if (openingBrace < 0) {
    throw new Error(`CSS block has no opening brace: ${marker}`)
  }

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(openingBrace + 1, index)
    }
  }

  throw new Error(`CSS block has no matching closing brace: ${marker}`)
}

/** Normalize whitespace outside quoted strings without changing CSS values. */
export function normalizeCssValue(value: string): string {
  let normalized = ""
  let quote: '"' | "'" | undefined
  let escaped = false
  let pendingSpace = false

  for (const character of value.trim()) {
    if (quote) {
      normalized += character
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = undefined
      continue
    }

    if (character === '"' || character === "'") {
      if (pendingSpace && normalized) normalized += " "
      pendingSpace = false
      quote = character
      normalized += character
    } else if (/\s/.test(character)) {
      pendingSpace = true
    } else {
      if (pendingSpace && normalized) normalized += " "
      pendingSpace = false
      normalized += character
    }
  }

  return normalized.trim()
}

/** Parse custom-property declarations, including values spanning lines. */
export function parseCustomProperties(block: string): Map<string, string> {
  const properties = new Map<string, string>()
  let index = 0

  while (index < block.length) {
    const character = block[index]
    let previous = index - 1
    while (previous >= 0 && /\s/.test(block[previous])) previous -= 1
    const atDeclarationBoundary = previous < 0 || /[;{}]/.test(block[previous])
    if (character !== "-" || block[index + 1] !== "-" || !atDeclarationBoundary) {
      index += 1
      continue
    }

    const nameMatch = block.slice(index).match(/^(--[a-z0-9-]+)\s*:/)
    if (!nameMatch) {
      index += 1
      continue
    }

    const name = nameMatch[1]
    let valueStart = index + nameMatch[0].length
    let quote: '"' | "'" | undefined
    let escaped = false
    let parentheses = 0
    let valueEnd = block.length

    for (; valueStart < block.length; valueStart += 1) {
      const current = block[valueStart]
      if (quote) {
        if (escaped) escaped = false
        else if (current === "\\") escaped = true
        else if (current === quote) quote = undefined
        continue
      }
      if (current === '"' || current === "'") quote = current
      else if (current === "(") parentheses += 1
      else if (current === ")") parentheses = Math.max(0, parentheses - 1)
      else if (current === ";" && parentheses === 0) {
        valueEnd = valueStart
        break
      }
    }

    properties.set(name, normalizeCssValue(block.slice(index + nameMatch[0].length, valueEnd)))
    index = valueEnd < block.length ? valueEnd + 1 : block.length
  }

  return properties
}
