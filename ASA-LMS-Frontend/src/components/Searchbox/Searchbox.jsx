import React from "react";
import "./Searchbox.css";
import { IoSearchSharp } from "react-icons/io5";

const Searchbox = React.memo(({ value, onChange }) => {
  return (
    <div className="custom-search-box">
      <input type="text" placeholder="Search..." value={value} onChange={onChange} />
      <IoSearchSharp size={22} />
    </div>
  );
});

export default Searchbox;
