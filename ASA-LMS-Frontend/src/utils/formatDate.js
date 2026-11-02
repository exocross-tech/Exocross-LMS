function formatDate(dateString, format) {
  if (!dateString || dateString === "-") return "-";

  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const amPm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  if (format === "date") {
    return `${day}/${month}/${year}`;
  } else if (format == "time") {
    return `${hours}:${minutes} ${amPm}`;
  } else {
    return `${day}/${month}/${year} ${hours}:${minutes} ${amPm}`;
  }
}

export default formatDate;
