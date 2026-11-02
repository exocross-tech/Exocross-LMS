const BtnClear = ({ formReset }) => {
  return (
    <>
      <button type="button" className="btn btn-danger" onClick={formReset}>
        Clear
      </button>
    </>
  );
};

export default BtnClear;
