export function filterByKeys(data, search, keys = []) {
  
    if (!Array.isArray(data) || !search || keys.length === 0) return data;
  
    const keyword = search.toLowerCase();
  
    return data.filter((row) =>
      keys.some((key) => {
        const value = row[key];
        return value?.toString().toLowerCase().includes(keyword);
      })
    );
  }
  