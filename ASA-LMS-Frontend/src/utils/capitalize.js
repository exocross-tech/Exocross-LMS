  
      export const capitalize = (str = "") =>
        str
          .split(" ")
          .map(word =>
            word.length > 1
              ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              : word.toUpperCase()
          )
          .join(" ");
      