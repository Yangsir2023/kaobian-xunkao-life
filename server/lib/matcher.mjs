/**
 * 查询条件匹配器：本地驱动用它模拟云数据库的 where 语义。
 * 支持：等值、$ne / $in / $nin / $gte / $lte / $gt / $lt / $regex / $exists / $or
 * 保持与 CloudBase 查询能力对齐，两套驱动读同一份 filter 对象。
 */
export function matchOne(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, condition] of Object.entries(filter)) {
    if (key === '$or') {
      if (!Array.isArray(condition) || !condition.some((sub) => matchOne(doc, sub))) return false;
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(condition) || !condition.every((sub) => matchOne(doc, sub))) return false;
      continue;
    }

    const actual = readPath(doc, key);
    if (!matchValue(actual, condition)) return false;
  }
  return true;
}

function readPath(doc, path) {
  if (!path.includes('.')) return doc?.[path];
  return path.split('.').reduce((acc, seg) => (acc == null ? undefined : acc[seg]), doc);
}

function matchValue(actual, condition) {
  const isOperatorObject =
    condition !== null &&
    typeof condition === 'object' &&
    !Array.isArray(condition) &&
    Object.keys(condition).some((k) => k.startsWith('$'));

  if (!isOperatorObject) {
    if (Array.isArray(actual) && !Array.isArray(condition)) return actual.includes(condition);
    return actual === condition;
  }

  for (const [op, operand] of Object.entries(condition)) {
    switch (op) {
      case '$eq':
        if (actual !== operand) return false;
        break;
      case '$ne':
        if (actual === operand) return false;
        break;
      case '$in':
        if (!Array.isArray(operand) || !operand.includes(actual)) return false;
        break;
      case '$nin':
        if (Array.isArray(operand) && operand.includes(actual)) return false;
        break;
      case '$gte':
        if (!compare(actual, operand, (a, b) => a >= b)) return false;
        break;
      case '$lte':
        if (!compare(actual, operand, (a, b) => a <= b)) return false;
        break;
      case '$gt':
        if (!compare(actual, operand, (a, b) => a > b)) return false;
        break;
      case '$lt':
        if (!compare(actual, operand, (a, b) => a < b)) return false;
        break;
      case '$exists':
        if ((actual !== undefined) !== Boolean(operand)) return false;
        break;
      case '$regex': {
        const flags = condition.$options || '';
        const re = operand instanceof RegExp ? operand : new RegExp(operand, flags);
        if (typeof actual !== 'string' || !re.test(actual)) return false;
        break;
      }
      case '$options':
        break;
      default:
        throw new Error(`不支持的查询操作符：${op}`);
    }
  }
  return true;
}

function compare(a, b, fn) {
  const av = toComparable(a);
  const bv = toComparable(b);
  if (av === null || bv === null) return false;
  return fn(av, bv);
}

function toComparable(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const asDate = Date.parse(value);
    // 形如 2026-11-29 的日期串按时间戳比较，其余按字典序
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(asDate)) return asDate;
    return value;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

/** 把 filter 转成 CloudBase 的 where（等值直接给，操作符转 db.command） */
export function toCloudBaseWhere(filter, _command) {
  const out = {};
  for (const [key, condition] of Object.entries(filter || {})) {
    if (key === '$or' || key === '$and') {
      out[key] = condition.map((sub) => toCloudBaseWhere(sub, _command));
      continue;
    }
    const isOperatorObject =
      condition !== null &&
      typeof condition === 'object' &&
      !Array.isArray(condition) &&
      Object.keys(condition).some((k) => k.startsWith('$'));
    if (!isOperatorObject) {
      out[key] = Array.isArray(condition) ? _command.in(condition) : condition;
      continue;
    }
    const ops = {};
    for (const [op, operand] of Object.entries(condition)) {
      ops[op.slice(1)] = operand;
    }
    out[key] = _command.and
      ? Object.entries(ops).reduce((acc, [op, operand]) => {
          switch (op) {
            case 'eq': return _command.eq(operand);
            case 'ne': return _command.neq(operand);
            case 'in': return _command.in(operand);
            case 'nin': return _command.nin(operand);
            case 'gte': return _command.gte(operand);
            case 'lte': return _command.lte(operand);
            case 'gt': return _command.gt(operand);
            case 'lt': return _command.lt(operand);
            default: return acc;
          }
        }, null)
      : null;
  }
  return out;
}
