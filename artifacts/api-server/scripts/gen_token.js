const jwt = require('jsonwebtoken');
const secret = process.env.SESSION_SECRET || 'smart-clinic-secret-key';
const token = jwt.sign({ userId: 'bfcb9616-ef16-4bf9-bb83-c1a8dfd543c6', email: 'orphan@example.com', role: 'clinic_admin', userType: 'staff' }, secret, { expiresIn: '7d' });
console.log(token);
