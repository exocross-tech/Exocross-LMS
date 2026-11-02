const { exec } = require("child_process");
const path = require("path");

const sofficePath = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`;

module.exports = function convertPptToHtml(inputFile, outputDir) {
    return new Promise((resolve, reject) => {
        const command = `${sofficePath} --headless --convert-to html --outdir "${outputDir}" "${inputFile}"`;

        exec(command, (error) => {
            if (error) {
                return reject(error);
            }

            const htmlFile =
                path.basename(inputFile, path.extname(inputFile)) + ".html";

            resolve(path.join(outputDir, htmlFile));
        });
    });
};