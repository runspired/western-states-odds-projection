import { helper } from '@ember/component/helper';

function substring([num, mult = 1]) {
  if (num === 'N/A') {
    return num;
  }
  return (num * mult).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default helper(substring);
