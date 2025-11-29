# Data Directory

This directory stores user and invoice data in JSON format.

## Files (Auto-generated)

- `users.json` - User accounts and authentication data
- `invoices.json` - Invoice records

**⚠️ SECURITY NOTICE:**

These files are automatically created when the application runs and are **excluded from Git** for security reasons.

## Initial Setup

When you first run the application:

1. These files will be created automatically
2. Create your first admin user:
```bash
   npm run create-admin "Admin Name" admin@example.com password 1234567890
```

## Backup Recommendation

For production: Use proper database (PostgreSQL/MongoDB)