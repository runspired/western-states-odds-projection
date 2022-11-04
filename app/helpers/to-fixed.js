import { helper } from '@ember/component/helper';

function substring([num, mult = 1]) {
  return (num * mult).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default helper(substring);
