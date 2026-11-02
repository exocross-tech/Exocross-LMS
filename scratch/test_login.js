async function testLogin(email, password) {
  try {
    const res = await fetch('http://localhost:3310/api/login/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ USERNAME: email, PASSWORD: password })
    });
    const data = await res.json();
    console.log(`LOGIN RESULT for ${email} with password "${password}":`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`ERROR for ${email}:`, err.message);
  }
}

async function main() {
  await testLogin('isravel@gmail.com', 'isravel@2004');
  await testLogin('isravel@gmail.com', '123456');
  await testLogin('isravel@gmail.com', 'isravel');
  await testLogin('israel210904@gmail.com', '123456');
}

main();
