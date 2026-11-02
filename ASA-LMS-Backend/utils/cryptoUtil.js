const crypto = require("crypto");
const fs = require("fs");

const algorithm = "aes-256-cbc";
const key = crypto
  .createHash("sha256")
  .update(process.env.EBOOK_SECRET || "local-dev-secret")
  .digest();

function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    output.write(iv); // store IV at file start
    input.pipe(cipher).pipe(output);

    let inputClosed = false;
    let outputClosed = false;

    const checkDone = () => {
      if (inputClosed && outputClosed) resolve();
    };

    input.on("close", () => {
      inputClosed = true;
      checkDone();
    });

    output.on("close", () => {
      outputClosed = true;
      checkDone();
    });

    input.on("error", reject);
    output.on("error", reject);
    cipher.on("error", reject);
  });
}

function decryptBuffer(encPath) {
  const data = fs.readFileSync(encPath);

  const iv = data.slice(0, 16);
  const encrypted = data.slice(16);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}


module.exports = { encryptFile, decryptBuffer };
