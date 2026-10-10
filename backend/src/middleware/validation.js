export function validateRegisterInput(req, res, next) {
  const { fullName, email, password } = req.body;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    return res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
  }

  if (fullName.length > 100) {
    return res.status(400).json({ error: 'Full name exceeds maximum length of 100 characters.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.'
    });
  }

  // Sanitize trimmed values
  req.body.fullName = fullName.trim();
  req.body.email = email.trim().toLowerCase();
  if (req.body.company && typeof req.body.company === 'string') {
    req.body.company = req.body.company.trim().slice(0, 100);
  }

  next();
}

export function validateLoginInput(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

export function validateInspectionInput(req, res, next) {
  const { title, propertyAddress, propertyType, clientName } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Inspection title is required.' });
  }

  req.body.title = title.trim().slice(0, 255);
  if (propertyAddress) req.body.propertyAddress = String(propertyAddress).trim().slice(0, 500);
  if (propertyType) req.body.propertyType = String(propertyType).trim().slice(0, 100);
  if (clientName) req.body.clientName = String(clientName).trim().slice(0, 255);

  next();
}
