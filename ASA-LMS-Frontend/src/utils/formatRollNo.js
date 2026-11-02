/**
 * Formats a student roll number into the standard NN-AICP-YY format.
 * Examples:
 *   ASA-26-54  -> 54-AICP-26
 *   ASA-26-01  -> 01-AICP-26
 *   26-AICP-55 -> 55-AICP-26
 *   01-AICP-26 -> 01-AICP-26
 *   ROLL-8801  -> ROLL-8801
 */
export const formatStudentRollNo = (rollNo) => {
  if (!rollNo || typeof rollNo !== "string") return "-";
  const trimmed = rollNo.trim();
  if (!trimmed || trimmed === "-") return "-";

  // Check if it already matches NN-AICP-YY (e.g. 01-AICP-26)
  if (/^\d+-AICP-\d+$/i.test(trimmed)) {
    const parts = trimmed.split("-");
    return `${parts[0].padStart(2, "0")}-AICP-${parts[2]}`;
  }

  // Handle ASA-YY-NN (e.g. ASA-26-54 -> 54-AICP-26)
  const asaMatch = trimmed.match(/^ASA-(\d+)-(\d+)$/i);
  if (asaMatch) {
    const year = asaMatch[1];
    const seq = asaMatch[2].padStart(2, "0");
    return `${seq}-AICP-${year}`;
  }

  // Handle YY-AICP-NN (e.g. 26-AICP-55 -> 55-AICP-26)
  const ymAicpMatch = trimmed.match(/^(\d+)-AICP-(\d+)$/i);
  if (ymAicpMatch) {
    const year = ymAicpMatch[1];
    const seq = ymAicpMatch[2].padStart(2, "0");
    return `${seq}-AICP-${year}`;
  }

  // Fallback: return raw trimmed roll number
  return trimmed;
};

export default formatStudentRollNo;
