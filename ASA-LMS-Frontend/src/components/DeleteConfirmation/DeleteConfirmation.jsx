import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FaTrash } from "react-icons/fa";


const DeleteConfirmation = ({ title, text, icon, confirmButtonText, onConfirm, trigger, deleteId, tooltipId, tooltipContent }) => {
  const showSwal = () => {
    Swal.fire({
      title: title || "Are you sure?",
      text: text || "You won't be able to revert this!",
      icon: icon || "warning",
      showCancelButton: true,
      confirmButtonText: confirmButtonText || "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed && onConfirm) {
        onConfirm(deleteId);
      }
    });
  };

  return <span onClick={showSwal} style={{ cursor: "pointer" }} className="pointer" data-tooltip-id={tooltipId} data-tooltip-content={tooltipContent}>{trigger}</span>;
};

export default DeleteConfirmation;
