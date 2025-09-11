// Simple test to call the ingest API
const response = await fetch('http://localhost:3000/github/ingest/users-strict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    users: ['barlavi1', 'UrielOfir']
  })
});

const result = await response.text();
console.log('Status:', response.status);
console.log('Response:', result);