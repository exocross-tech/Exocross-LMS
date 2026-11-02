export const createChunks = (file, chunkSize = 5 * 1024 * 1024) => {
  const chunks = [];
  let start = 0;

  while (start < file.size) {
    chunks.push(file.slice(start, start + chunkSize));
    start += chunkSize;
  }
  return chunks;
};