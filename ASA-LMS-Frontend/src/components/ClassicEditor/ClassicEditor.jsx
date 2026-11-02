// import React from "react";
// import { CKEditor } from "@ckeditor/ckeditor5-react";
// import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

// const QuestionEditor = ({ label, placeholder, value, onChange, required }) => {
//   return (
//     <div className="qb-editor-container mb-3">
//       {label && (
//         <label className="form-label fw-medium text-dark mb-1">
//           {label} {required && <span className="text-danger">*</span>}
//         </label>
//       )}
//       <div className="qb-editor-wrapper">
//         <CKEditor
//           editor={ClassicEditor}
//           data={value || ""}
//           onChange={(event, editor) => {
//             const data = editor.getData();
//             if (onChange) {
//               onChange(data);
//             }
//           }}
//           config={{
//             placeholder: placeholder || "Type text here...",
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default QuestionEditor;

import React, { useState, useEffect, useRef } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import axios from "axios";
import pica from "pica";
import { normalizeCKEditorImages, normalizeImageUrl } from "../../utils/imageUtils";
import "./ClassicEditor.css";

const HOST = import.meta.env.VITE_API_BASE_URL || "";

const QuestionEditor = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  minHeight = "150px",
}) => {
  const [editorData, setEditorData] = useState(normalizeCKEditorImages(value || ""));
  const uploadedImagesRef = useRef([]);
  const editorInstanceRef = useRef(null);
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    const normalized = normalizeCKEditorImages(value || "");
    setEditorData(normalized);
    if (editorInstanceRef.current && !isInternalChangeRef.current) {
      const currentData = editorInstanceRef.current.getData();
      if (currentData !== normalized) {
        editorInstanceRef.current.setData(normalized);
      }
    }
    isInternalChangeRef.current = false;
  }, [value]);

  function uploadAdapter(loader) {
    return {
      upload: () =>
        loader.file.then((file) => {
          return new Promise((resolve, reject) => {
            const existing = document.getElementById("resizeModal");
            if (existing) existing.remove();

            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = () => {
              const img = new Image();
              img.src = reader.result;

              img.onload = () => {
                const modal = document.createElement("div");
                modal.id = "resizeModal";
                modal.style.cssText = `
                  position: fixed; inset: 0;
                  background: rgba(0,0,0,0.85);
                  display: flex; align-items: center; justify-content: center;
                  z-index: 20000; flex-direction: column; color: #fff;
                `;

                const wrapper = document.createElement("div");
                wrapper.style.cssText =
                  "max-width:900px; width:90%; text-align:center;";

                const imgPreview = document.createElement("img");
                imgPreview.style.cssText =
                  "max-width:100%; max-height:400px; border:4px solid #fff; display:block; margin:0 auto;";

                const controls = document.createElement("div");
                controls.style.cssText =
                  "margin-top:12px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;";

                const widthInput = document.createElement("input");
                widthInput.type = "number";
                widthInput.placeholder = "Width (px)";
                widthInput.style.cssText = "padding:6px; width:140px;";

                const heightInput = document.createElement("input");
                heightInput.type = "number";
                heightInput.placeholder = "Height (px)";
                heightInput.style.cssText = "padding:6px; width:140px;";

                const keepAspectLabel = document.createElement("label");
                keepAspectLabel.style.cssText =
                  "display:flex; gap:6px; align-items:center; margin-left:8px;";
                const keepAspect = document.createElement("input");
                keepAspect.type = "checkbox";
                keepAspect.checked = true;
                keepAspectLabel.appendChild(keepAspect);
                keepAspectLabel.appendChild(
                  document.createTextNode("Lock aspect")
                );

                controls.appendChild(widthInput);
                controls.appendChild(heightInput);
                controls.appendChild(keepAspectLabel);

                const btnRow = document.createElement("div");
                btnRow.style.cssText =
                  "margin-top:12px; display:flex; gap:10px; justify-content:center;";

                const resizeBtn = document.createElement("button");
                resizeBtn.innerText = "Resize & Upload";
                resizeBtn.style.cssText =
                  "background:#28a745;padding:10px 16px;border:none;border-radius:6px;color:#fff;cursor:pointer;";

                const cancelBtn = document.createElement("button");
                cancelBtn.innerText = "Cancel";
                cancelBtn.style.cssText =
                  "background:#dc3545;padding:10px 16px;border:none;border-radius:6px;color:#fff;cursor:pointer;";

                const previewBtn = document.createElement("button");
                previewBtn.innerText = "Preview";
                previewBtn.style.cssText =
                  "background:#007bff;padding:10px 16px;border:none;border-radius:6px;color:#fff;cursor:pointer;";

                btnRow.appendChild(previewBtn);
                btnRow.appendChild(resizeBtn);
                btnRow.appendChild(cancelBtn);

                wrapper.appendChild(imgPreview);
                wrapper.appendChild(controls);
                wrapper.appendChild(btnRow);
                modal.appendChild(wrapper);
                document.body.appendChild(modal);
                document.body.classList.remove("modal-open");

                imgPreview.src = reader.result;
                widthInput.value = img.naturalWidth;
                heightInput.value = img.naturalHeight;
                const aspect = img.naturalWidth / img.naturalHeight;

                widthInput.addEventListener("input", () => {
                  if (keepAspect.checked) {
                    const w = parseInt(widthInput.value) || img.naturalWidth;
                    heightInput.value = Math.round(w / aspect);
                  }
                });
                heightInput.addEventListener("input", () => {
                  if (keepAspect.checked) {
                    const h = parseInt(heightInput.value) || img.naturalHeight;
                    widthInput.value = Math.round(h * aspect);
                  }
                });

                previewBtn.onclick = () => {
                  const w = parseInt(widthInput.value) || img.naturalWidth;
                  const h = parseInt(heightInput.value) || img.naturalHeight;
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, w, h);
                  imgPreview.src = canvas.toDataURL("image/png");
                };

                // cancelBtn.onclick = () => {
                //   modal.remove();
                //   reject(new Error("User cancelled image upload."));
                // };
                cancelBtn.onclick = () => {
                  modal.remove();
                  document.body.classList.add("modal-open");
                  reject(new Error("User cancelled image upload."));
                };
                resizeBtn.onclick = async () => {
                  try {
                    resizeBtn.disabled = true;
                    cancelBtn.disabled = true;
                    resizeBtn.innerText = "Processing...";

                    const targetWidth =
                      parseInt(widthInput.value) || img.naturalWidth;
                    const targetHeight =
                      parseInt(heightInput.value) || img.naturalHeight;

                    const canvas = document.createElement("canvas");
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    await pica().resize(img, canvas, {
                      unsharpAmount: 80,
                      unsharpRadius: 0.6,
                      unsharpThreshold: 2,
                    });

                    canvas.toBlob(
                      async (blob) => {
                        const readerBlob = new FileReader();
                        readerBlob.onloadend = async () => {
                          const base64String = readerBlob.result;
                          const uploadUrlEndpoint = `${HOST.replace(/\/+$/, "")}/questions/uploadImage`;
                          const res = await axios.post(
                            uploadUrlEndpoint,
                            { image: base64String }
                          );
                          const rawUrl = res.data.default || res.data.url || res.data.relativeUrl;
                          const uploadedUrl = normalizeImageUrl(rawUrl);

                          uploadedImagesRef.current.push(uploadedUrl);
                          resolve({ default: uploadedUrl });
                          modal.remove();
                          document.body.classList.add("modal-open");
                        };
                        readerBlob.readAsDataURL(blob);
                      },
                      "image/png",
                      0.9
                    );
                  } catch (err) {
                    modal.remove();
                    reject(err);
                  }
                };
              };

              img.onerror = (err) => {
                reject(new Error("Failed to load image for resizing."));
              };
            };

            reader.onerror = (err) => {
              reject(err);
            };
          });
        }),
      abort: () => {
        const modal = document.getElementById("resizeModal");
        //if (modal) modal.remove();
        if (modal) {
          modal.remove();
          document.body.classList.add("modal-open");
        }
      },
    };
  }

  function enableImageResizeInEditor(editor) {
    editor.editing.view.document.on("click", (evt, data) => {
      const target = data.domEvent.target;
      if (target && target.tagName === "IMG") {
      }
    });
  }

  /** Enable delete tracking */
  // function enableImageDeleteTracking(editor) {
  //   editor.model.document.on("change:data", async () => {
  //     const currentImages = [];
  //     for (const item of editor.model.document.getRoot().getChildren()) {
  //       if (item.is("element", "image")) {
  //         currentImages.push(item.getAttribute("src"));
  //       }
  //     }

  //     const previousImages = uploadedImagesRef.current;
  //     const deletedImages = previousImages.filter(src => !currentImages.includes(src));

  //     for (const src of deletedImages) {
  //       try {
  //         await axios.post(`${HOST}questions/deleteCkeditorImage`, { image: src });
  //         uploadedImagesRef.current = uploadedImagesRef.current.filter(u => u !== src);
  //       } catch (err) {
  //         console.error("Failed to delete image:", src, err);
  //       }
  //     }
  //   });
  // }

  /** Plugin to integrate our upload adapter */
  function uploadPlugin(editor) {
    editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
      return uploadAdapter(loader);
    };
  }

  const wrapperStyle = {
    "--editor-min-height":
      typeof minHeight === "number" ? `${minHeight}px` : minHeight,
  };

  return (
    <div className="qb-editor-container mb-3" style={wrapperStyle}>
      {label && (
        <label className="form-label fw-medium mb-1" style={{ color: "#e2e8f0" }}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <div className="qb-editor-wrapper">
        <CKEditor
          editor={ClassicEditor}
          data={editorData}
          config={{
            extraPlugins: [uploadPlugin],
            image: {
              toolbar: [
                "imageTextAlternative",
                "|",
                "toggleImageCaption",
                "imageStyle:side",
                "imageStyle:alignLeft",
                "imageStyle:alignRight",
              ],
              styles: ["full", "alignLeft", "alignRight"],
            },
            toolbar: [
              "heading",
              "|",
              "bold",
              "italic",
              "|",
              "link",
              "blockQuote",
              "|",
              "bulletedList",
              "numberedList",
              "outdent",
              "indent",
              "|",
              "imageUpload",
              "insertTable",
              "mediaEmbed",
              "|",
              "undo",
              "redo",
            ],
            placeholder,
          }}
          onReady={(editor) => {
            editorInstanceRef.current = editor;
            enableImageResizeInEditor(editor);
            //enableImageDeleteTracking(editor);
          }}
          onChange={(event, editor) => {
            const data = editor.getData();
            isInternalChangeRef.current = true;
            setEditorData(data);
            onChange(data);
          }}
        />
      </div>
    </div>
  );
};

export default QuestionEditor;
