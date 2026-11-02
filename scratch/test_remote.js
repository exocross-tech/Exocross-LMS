async function testRemoteTutor() {
  try {
    const res = await fetch('https://asalms.learntechnoschool.in/api/login/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ USERNAME: 'israel210904@gmail.com', PASSWORD: 'any' })
    });
    const data = await res.json();
    console.log('REMOTE LOGIN RESULT FOR israel210904@gmail.com:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('REMOTE LOGIN ERROR:', err.message);
  }
}

testRemoteTutor();
