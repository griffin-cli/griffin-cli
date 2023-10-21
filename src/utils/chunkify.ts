export default <T = unknown>(arr: T[], chunkSize: number): T[][] => {
  if (!arr?.length) {
    return [[]];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
};
