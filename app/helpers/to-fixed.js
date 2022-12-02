import { helper } from '@ember/component/helper';

const _cache = new Map();
function getStr(num) {
  let str = _cache.get(num);

  if (!str) {
    str = num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    _cache.set(num, str);
  }

  return str;
}

function substring(args) {
  const num = args[0];
  const mult = args[1] || 1;
  if (num === 'N/A') {
    return num;
  }

  return /*#__NOINLINE__*/ getStr(num * mult);
}

export default helper(substring);
