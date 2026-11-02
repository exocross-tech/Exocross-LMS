import React, { useEffect, useState, useRef } from "react";
import "./Autocomplete.css";
import MasterAddModal from "../MasterAddModal/MasterAddModal";
import { hospitalApi, doctorApi } from "../../services/apiService";
import { toast } from "react-toastify";

const AutoComplete = ({
  labelName,
  data,
  filteredKeyword,
  appendKey,
  onSelect,
  value,
  onDataUpdate,
  required,
}) => {
  const [query, setQuery] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const [newData, setNewData] = useState(false);

  useEffect(() => {
    if (data && data.length > 0) {
      setSuggestions(
        data.map((item) => ({
          ...item,
          searchKey: item[filteredKeyword] || "",
        }))
      );
    }
  }, [data, filteredKeyword]);

  useEffect(() => {
    if (!value || Object.keys(value).length === 0) {
      setQuery("");
    } else {
      setNewData(true);
      setQuery(value?.[appendKey] ?? "");
    }
  }, [value, appendKey]);

  const handleChange = (e) => {
    const input = e.target.value;
    setQuery(input);
    setHighlightedIndex(-1);

    if (input.trim() === "") {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      onSelect("", filteredKeyword);
      return;
    }

    const filtered = suggestions.filter((item) =>
      item.searchKey?.toLowerCase().includes(input.toLowerCase())
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleSelect = (selected) => {
    setQuery(selected[appendKey]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    if (onSelect) {
      onSelect(selected, filteredKeyword);
    }
  };

  const handleClear = () => {
    setQuery("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onSelect("", filteredKeyword);
    setNewData(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      setHighlightedIndex((prevIndex) =>
        Math.min(prevIndex + 1, filteredSuggestions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        handleSelect(filteredSuggestions[highlightedIndex]);
      } else if (query.length > 0) {
        <MasterAddModal
          title="Are you sure you want to add this?"
          text={`The value "${query}" will be added.`}
          confirmButtonText="Add"
          cancelButtonText="Cancel"
          confirmButtonClassName="confirm-btn"
          cancelButtonClassName="cancel-btn"
          onConfirm={() => handleSave(query)}
          trigger={<button className="add-btn">Add</button>}
        />;
      }
    }
  };

  const scrollIntoView = (index) => {
    // if (suggestionsRef.current) {
    //   const suggestionItems = suggestionsRef.current.querySelectorAll(
    //     ".autocomplete-suggestion"
    //   );
    //   if (suggestionItems[index]) {
    //     suggestionItems[index].scrollIntoView({
    //       behavior: "smooth",
    //       block: "nearest",
    //     });
    //   }
    // }
    const list = suggestionsRef.current;
    if (list && list.children[index]) {
      list.children[index].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0) {
      scrollIntoView(highlightedIndex);
    }
  }, [highlightedIndex]);

  const handleSave = async (formName) => {
    if (formName === "Hospital") {
      try {
        let obj = {
          ID: "",
          HOSPITAL_NAME: query,
          ADDRESS: "-",
          PHONE: "-",
          WHATSAPP_NUMBER: "-",
          EMAIL: "-",
        };
        let res = await hospitalApi.addHospital(obj);
        if (res?.data?.status === 1) {
          toast.success(res?.data?.message);
          if (onDataUpdate) {
            onDataUpdate(obj);
            setNewData(true);
          }
        } else {
          toast.error(res?.data?.message);
        }
      } catch (err) {
        toast.error(err.message);
      }
    } else if (formName === "Doctor") {
      try {
        let obj = {
          ID: "",
          DOCTOR_NAME: query,
          ADDRESS: "-",
          PHONE: "-",
          WHATSAPP_NUMBER: "-",
          EMAIL: "-",
        };
        let res = await doctorApi.addDoctor(obj);
        if (res?.data?.status === 1) {
          toast.success(res?.data?.message);
          if (onDataUpdate) {
            onDataUpdate(obj);
            setNewData(true);
          }
        } else {
          toast.error(res?.data?.message);
        }
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  return (
    <>
      <div>
        <label className="form-label m-0">
          {labelName} {required && <span className="text-danger"> *</span>}
        </label>
        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="text"
              className={`form-control ${
                query && filteredSuggestions.length === 0 ? "reduced-width" : ""
              }`}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={"Search " + labelName + "..."}
            />
            {query && (
              <span className="clear-icon" onClick={handleClear}>
                ✖
              </span>
            )}
          </div>
          {!newData && query && filteredSuggestions.length === 0 && (
            <MasterAddModal
              onConfirm={handleSave}
              trigger={
                <button className="btn btn-primary save-btn">
                  Add {labelName}
                </button>
              }
              title={filteredKeyword == "HOSPITAL_NAME" ? "Hospital" : "Doctor"}
            />
          )}
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="autocomplete-suggestions mx-3" ref={suggestionsRef}>
            {filteredSuggestions.map((item, index) => (
              <li
                key={index}
                className={`autocomplete-suggestion ${
                  index === highlightedIndex ? "highlighted" : ""
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {item.searchKey}
              </li>
            ))}
          </ul>
        )}
        {!newData &&
          showSuggestions === false &&
          filteredSuggestions.length === 0 &&
          query !== "" && (
            <span className="mt-2 text-danger">No matches found.</span>
          )}
      </div>
    </>
  );
};

export default AutoComplete;
