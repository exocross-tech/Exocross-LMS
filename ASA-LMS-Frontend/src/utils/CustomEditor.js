import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { UploadAdapter, FileLoader } from "@ckeditor/ckeditor5-upload/src/filerepository";
// Create a custom editor class
export default class CustomEditor extends ClassicEditorBase {}

CustomEditor.defaultConfig = {
    toolbar: [
      "heading",
      "|",
      "bold",
      "italic",
      "link",
      "bulletedList",
      "numberedList",
      "imageUpload", // already works with built-in Base64 adapter
      "|",
      "undo",
      "redo",
    ],
    language: "en",
  };
