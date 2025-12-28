# Database Setup Guide

This application uses Sequelize ORM with MySQL database.

## Installing MySQL

### Windows
1. Download MySQL from https://dev.mysql.com/downloads/mysql/
2. Run the installer and follow the setup wizard
3. Set root password to empty (no password) or update the database.js file accordingly
4. Start MySQL service

### Alternative: Using XAMPP (includes MySQL)
1. Download XAMPP from https://www.apachefriends.org/
2. Install and run XAMPP
3. Start MySQL from XAMPP control panel

## Database Configuration

### Manual Database Creation

Before running the application, create the database:

```sql
CREATE DATABASE `node-complete`;
```

Or using MySQL command line:
```bash
mysql -u root -p
CREATE DATABASE `node-complete`;
exit;
```

### Automatic Table Creation

The application will automatically:
- Create the `products` table based on the Sequelize model definition
- Sync the database schema on application startup

## Manual Database Creation (Optional)

If you prefer to create the database manually, run:

```sql
CREATE DATABASE IF NOT EXISTS `node-complete`;
```

## Testing the Connection

Start the application:

```bash
npm start
```

You should see in the console:
- "Database connected successfully"
- "Database synced successfully"

## Database Schema

The `products` table will have the following structure:
- `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
- `title` (VARCHAR(255), NOT NULL)
- `price` (DOUBLE, NOT NULL)
- `description` (TEXT)
- `imageUrl` (VARCHAR(255))
- `createdAt` and `updatedAt` (timestamps added by Sequelize)

## Troubleshooting

- If you get connection errors, make sure MySQL is running
- Check that the database name in `utils/database.js` matches your MySQL setup
- Ensure the MySQL port (default 3306) is not blocked by firewall
- The application uses Sequelize, so no manual table creation is required
