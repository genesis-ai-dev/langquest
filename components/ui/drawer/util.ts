const isPercentage = (value: string | number) =>
  value && typeof value === 'string' && value.includes('%');

const toDecimal = (value: string | number) =>
  typeof value === 'string'
    ? Number(value.replace('%', '')) / 100
    : value / 100;

const convertSnapPoints = (snapPoints: (string | number)[]) =>
  snapPoints.map((point) =>
    isPercentage(point) ? toDecimal(point) : `${point}px`
  );

export { convertSnapPoints };
