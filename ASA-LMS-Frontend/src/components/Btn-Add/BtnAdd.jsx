import { PiPlusCircleBold } from "react-icons/pi";
import { IoListSharp } from "react-icons/io5";
const BtnAdd = ({ name, onClick, type }) => {
  return (
    <button type="button" className="btn btn-success" onClick={onClick}>
      {" "}
      {type === "list" ? (
        <IoListSharp size={18} />
      ) : (
        <PiPlusCircleBold size={18} />
      )}{" "}
      <span style={{ marginLeft: "8px" }}>{name}</span>{" "}
    </button>
  );
};
export default BtnAdd;
