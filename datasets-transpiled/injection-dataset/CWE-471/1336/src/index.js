module.exports = (obj = {}, key = '', value) => {
  key = key.split('.');

  let shift = key.shift();

  while ((item = obj[shift]) != null) {
    const cloneObj = obj;
    obj = obj[shift];
    const oldShift = shift;
    shift = key.shift();

    if (!shift) {
      if (value) {
        cloneObj[oldShift] = value;
      }
      return item;
      break;
    }
  }
};