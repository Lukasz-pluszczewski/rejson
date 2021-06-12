export const wile = <value>(
  condition: (value) => boolean,
  action: (value) => value,
  initialValue: value,
  { limit = 100000 } = {}
): value => {
  let i = 0;
  let value = initialValue;
  while (condition(value)) {
    if (i++ > limit) {
      break;
    }
    value = action();
  }
  return value;
};
